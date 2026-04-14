"""API router: /api/integrations — manage external system integration configs.

Integration definitions are declared in ``INTEGRATION_REGISTRY``.  Saved
config values live in the ``integration_configs`` PostgreSQL table and are
injected into ``os.environ`` so that MCP servers can resolve ``$VAR``
references via the existing ``resolve_env_variables()`` mechanism.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.gateway.db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["integrations"])


# ---------------------------------------------------------------------------
# Integration registry — add new integrations here
# ---------------------------------------------------------------------------

class IntegrationFieldDef(BaseModel):
    key: str
    label: str
    label_en: str
    type: str = "text"          # "text" | "url" | "secret"
    required: bool = True
    placeholder: str = ""


class IntegrationDef(BaseModel):
    display_name: str
    display_name_en: str
    description: str = ""
    description_en: str = ""
    env_mapping: dict[str, str]   # env_var -> config field key
    fields: list[IntegrationFieldDef]


INTEGRATION_REGISTRY: dict[str, IntegrationDef] = {
    "tcp-probe": IntegrationDef(
        display_name="TCP拨测系统",
        display_name_en="TCP Probe Monitor",
        description="网络探测监控平台，支持 PING/TCP/URL 拨测和告警",
        description_en="Network probe monitoring with PING/TCP/URL probes and alarms",
        env_mapping={
            "PROBE_MONITOR_API_BASE_URL": "base_url",
            "PROBE_MONITOR_API_KEY": "api_key",
        },
        fields=[
            IntegrationFieldDef(
                key="base_url",
                label="API 地址",
                label_en="API Base URL",
                type="url",
                required=True,
                placeholder="http://192.168.1.100:3000",
            ),
            IntegrationFieldDef(
                key="api_key",
                label="API Key",
                label_en="API Key",
                type="secret",
                required=True,
                placeholder="your-api-key",
            ),
        ],
    ),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mask_secret(value: str) -> str:
    """Return a masked version of a secret value for API responses."""
    if len(value) <= 4:
        return "****"
    return value[:4] + "****"


def _mask_config(config: dict[str, Any], fields: list[IntegrationFieldDef]) -> dict[str, Any]:
    """Return config with secret fields masked."""
    secret_keys = {f.key for f in fields if f.type == "secret"}
    masked = {}
    for k, v in config.items():
        if k in secret_keys and isinstance(v, str) and v:
            masked[k] = _mask_secret(v)
        else:
            masked[k] = v
    return masked


def _apply_env_vars(key: str, definition: IntegrationDef, config: dict[str, Any]) -> None:
    """Set os.environ entries from saved config values."""
    for env_var, config_field in definition.env_mapping.items():
        value = config.get(config_field, "")
        if value:
            os.environ[env_var] = value
            logger.debug("Set env %s for integration %s", env_var, key)


# ---------------------------------------------------------------------------
# Response / request models
# ---------------------------------------------------------------------------

class IntegrationFieldResponse(BaseModel):
    key: str
    label: str
    label_en: str
    type: str
    required: bool
    placeholder: str = ""


class IntegrationResponse(BaseModel):
    key: str
    display_name: str
    display_name_en: str
    description: str = ""
    description_en: str = ""
    fields: list[IntegrationFieldResponse]
    config: dict[str, Any] = Field(default_factory=dict)
    configured: bool = False


class IntegrationListResponse(BaseModel):
    integrations: list[IntegrationResponse]


class IntegrationUpdateRequest(BaseModel):
    config: dict[str, Any]


# ---------------------------------------------------------------------------
# Startup helper — called from lifespan
# ---------------------------------------------------------------------------

async def sync_integration_env_vars() -> None:
    """Load all saved integration configs from DB and set os.environ.

    Called once at application startup so MCP servers can resolve env
    variable references from the very first tool invocation.
    """
    try:
        conn = get_db()
        async with conn.cursor() as cur:
            await cur.execute("SELECT key, config FROM integration_configs")
            rows = await cur.fetchall()
            for row_key, row_config in rows:
                definition = INTEGRATION_REGISTRY.get(row_key)
                if definition is None:
                    continue
                cfg = row_config if isinstance(row_config, dict) else json.loads(row_config)
                _apply_env_vars(row_key, definition, cfg)
                logger.info("Loaded integration config: %s", row_key)
    except Exception:
        logger.exception("Failed to sync integration env vars from database")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/integrations",
    response_model=IntegrationListResponse,
    summary="List all integrations",
)
async def list_integrations() -> IntegrationListResponse:
    """Return every registered integration with its saved config (secrets masked)."""
    conn = get_db()

    # Load all saved configs in one query
    saved: dict[str, dict[str, Any]] = {}
    async with conn.cursor() as cur:
        await cur.execute("SELECT key, config FROM integration_configs")
        for row_key, row_config in await cur.fetchall():
            saved[row_key] = row_config if isinstance(row_config, dict) else json.loads(row_config)

    result: list[IntegrationResponse] = []
    for key, defn in INTEGRATION_REGISTRY.items():
        cfg = saved.get(key, {})
        masked = _mask_config(cfg, defn.fields) if cfg else {}
        configured = any(cfg.get(f.key) for f in defn.fields if f.required)
        result.append(
            IntegrationResponse(
                key=key,
                display_name=defn.display_name,
                display_name_en=defn.display_name_en,
                description=defn.description,
                description_en=defn.description_en,
                fields=[IntegrationFieldResponse(**f.model_dump()) for f in defn.fields],
                config=masked,
                configured=configured,
            )
        )
    return IntegrationListResponse(integrations=result)


@router.put(
    "/integrations/{key}",
    response_model=IntegrationResponse,
    summary="Update an integration config",
)
async def update_integration(key: str, request: IntegrationUpdateRequest) -> IntegrationResponse:
    """Save integration config to DB and inject into os.environ."""
    defn = INTEGRATION_REGISTRY.get(key)
    if defn is None:
        raise HTTPException(status_code=404, detail=f"Unknown integration: {key}")

    # Merge: if a secret field is sent as empty string or the masked placeholder,
    # keep the existing value from the database.
    conn = get_db()
    existing_cfg: dict[str, Any] = {}
    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT config FROM integration_configs WHERE key = %s", (key,)
        )
        row = await cur.fetchone()
        if row:
            existing_cfg = row[0] if isinstance(row[0], dict) else json.loads(row[0])

    secret_keys = {f.key for f in defn.fields if f.type == "secret"}
    merged: dict[str, Any] = {}
    for field in defn.fields:
        incoming = request.config.get(field.key, "")
        if field.key in secret_keys and (not incoming or "****" in str(incoming)):
            # Keep existing secret
            merged[field.key] = existing_cfg.get(field.key, "")
        else:
            merged[field.key] = incoming

    # Upsert into DB
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO integration_configs (key, config, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (key) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
            """,
            (key, json.dumps(merged, ensure_ascii=False)),
        )

    # Apply to os.environ immediately
    _apply_env_vars(key, defn, merged)

    # Return masked response
    masked = _mask_config(merged, defn.fields)
    configured = any(merged.get(f.key) for f in defn.fields if f.required)
    return IntegrationResponse(
        key=key,
        display_name=defn.display_name,
        display_name_en=defn.display_name_en,
        description=defn.description,
        description_en=defn.description_en,
        fields=[IntegrationFieldResponse(**f.model_dump()) for f in defn.fields],
        config=masked,
        configured=configured,
    )

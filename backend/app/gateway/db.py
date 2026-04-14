"""Async PostgreSQL connection pool for the gateway.

Uses psycopg 3 async pool.  The pool is created once during app startup
and closed on shutdown via the lifespan context manager in app.py.
"""

from __future__ import annotations

import logging
import os

import psycopg

logger = logging.getLogger(__name__)

# Module-level connection — lightweight alternative to a full pool.
_conn: psycopg.AsyncConnection | None = None


def _build_dsn() -> str:
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    user = os.environ.get("POSTGRES_USER", "aiops")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    db = os.environ.get("POSTGRES_DB", "aiops")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


async def init_db() -> None:
    """Open the shared async connection. Call once at startup."""
    global _conn
    if _conn is not None:
        return
    dsn = _build_dsn()
    _conn = await psycopg.AsyncConnection.connect(dsn, autocommit=True)
    logger.info("PostgreSQL connection established")


async def close_db() -> None:
    """Close the shared async connection. Call once at shutdown."""
    global _conn
    if _conn is not None:
        await _conn.close()
        _conn = None
        logger.info("PostgreSQL connection closed")


def get_db() -> psycopg.AsyncConnection:
    """Return the shared async connection. Raises if not initialised."""
    if _conn is None:
        raise RuntimeError("Database not initialised — call init_db() first")
    return _conn

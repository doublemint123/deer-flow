export interface MCPServerConfig extends Record<string, unknown> {
  enabled: boolean;
  description: string;
  env_status: "ok" | "missing" | "unconfigured";
}

export interface MCPConfig {
  mcp_servers: Record<string, MCPServerConfig>;
}

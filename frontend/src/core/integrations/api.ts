import { getBackendBaseURL } from "@/core/config";

import type { Integration, IntegrationListResponse } from "./types";

export async function loadIntegrations(): Promise<Integration[]> {
  const response = await fetch(`${getBackendBaseURL()}/api/integrations`);
  const data = (await response.json()) as IntegrationListResponse;
  return data.integrations;
}

export async function updateIntegration(
  key: string,
  config: Record<string, string>,
): Promise<Integration> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/integrations/${key}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update integration: ${response.statusText}`);
  }
  return response.json() as Promise<Integration>;
}

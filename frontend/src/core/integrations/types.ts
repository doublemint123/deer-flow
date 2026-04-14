export interface IntegrationField {
  key: string;
  label: string;
  label_en: string;
  type: "text" | "url" | "secret";
  required: boolean;
  placeholder: string;
}

export interface Integration {
  key: string;
  display_name: string;
  display_name_en: string;
  description: string;
  description_en: string;
  fields: IntegrationField[];
  config: Record<string, string>;
  configured: boolean;
}

export interface IntegrationListResponse {
  integrations: Integration[];
}

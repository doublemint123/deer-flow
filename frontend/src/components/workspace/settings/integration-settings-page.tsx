"use client";

import { CheckIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useIntegrations,
  useUpdateIntegration,
  type Integration,
  type IntegrationField,
} from "@/core/integrations";
import { useI18n } from "@/core/i18n/hooks";

import { SettingsSection } from "./settings-section";

export function IntegrationSettingsPage() {
  const { t } = useI18n();
  const { integrations, isLoading, error } = useIntegrations();

  return (
    <SettingsSection
      title={t.settings.integrations.title}
      description={t.settings.integrations.description}
    >
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t.common.loading}</div>
      ) : error ? (
        <div className="text-destructive text-sm">Error: {error.message}</div>
      ) : (
        integrations && (
          <div className="flex flex-col gap-6">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.key}
                integration={integration}
              />
            ))}
          </div>
        )
      )}
    </SettingsSection>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const { t, locale } = useI18n();
  const { mutateAsync, isPending } = useUpdateIntegration();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const isZh = locale === "zh-CN";
  const displayName = isZh
    ? integration.display_name
    : integration.display_name_en;
  const description = isZh
    ? integration.description
    : integration.description_en;

  // Initialize form values from saved config
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of integration.fields) {
      initial[field.key] = integration.config[field.key] ?? "";
    }
    setFormValues(initial);
  }, [integration]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await mutateAsync({ key: integration.key, config: formValues });
      toast.success(t.settings.integrations.saveSuccess);
    } catch {
      toast.error(t.settings.integrations.saveError);
    }
  }, [mutateAsync, integration.key, formValues, t]);

  const toggleSecretVisibility = useCallback((key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{displayName}</h3>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
            </p>
          )}
        </div>
        {integration.configured && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckIcon className="size-3" />
            {t.settings.integrations.configured}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {integration.fields.map((field) => (
          <IntegrationFieldInput
            key={field.key}
            field={field}
            value={formValues[field.key] ?? ""}
            showSecret={showSecrets[field.key] ?? false}
            onChange={(v) => handleFieldChange(field.key, v)}
            onToggleSecret={() => toggleSecretVisibility(field.key)}
            isZh={isZh}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2Icon className="size-4 animate-spin" />}
          {t.settings.integrations.save}
        </Button>
      </div>
    </div>
  );
}

function IntegrationFieldInput({
  field,
  value,
  showSecret,
  onChange,
  onToggleSecret,
  isZh,
}: {
  field: IntegrationField;
  value: string;
  showSecret: boolean;
  onChange: (value: string) => void;
  onToggleSecret: () => void;
  isZh: boolean;
}) {
  const label = isZh ? field.label : field.label_en;
  const isSecret = field.type === "secret";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium">
        {label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Input
          type={isSecret && !showSecret ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={isSecret ? "pr-9" : ""}
        />
        {isSecret && (
          <button
            type="button"
            onClick={onToggleSecret}
            className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
          >
            {showSecret ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { loadIntegrations, updateIntegration } from "./api";

export function useIntegrations() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => loadIntegrations(),
  });
  return { integrations: data, isLoading, error };
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      config,
    }: {
      key: string;
      config: Record<string, string>;
    }) => updateIntegration(key, config),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

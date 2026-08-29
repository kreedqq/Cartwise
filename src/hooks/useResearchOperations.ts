import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { OPERATIONS_RUN_PAGE_SIZE } from "@/lib/peptide/research/operations";
import type { OperationsAction } from "@/lib/peptide/research/operations/types";
import type { ScientificConnectorId } from "@/lib/peptide/research/updateEngine/types";
import {
  cancelAdminResearchRun,
  listAdminConnectorHealth,
  listAdminResearchRuns,
  retryAdminResearchRun,
  startAdminResearchRun,
} from "@/services/researchOperations";

export function useAdminResearchRuns(page: number) {
  return useQuery({
    queryKey: QUERY_KEYS.adminResearchRuns(page),
    queryFn: () => listAdminResearchRuns(page, OPERATIONS_RUN_PAGE_SIZE),
  });
}

export function useAdminConnectorHealth() {
  return useQuery({
    queryKey: ["admin-research-connector-health"],
    queryFn: () => listAdminConnectorHealth(),
  });
}

export function useStartAdminResearchRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      action: OperationsAction;
      substanceSlug?: string;
      connector?: ScientificConnectorId;
    }) => startAdminResearchRun(input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-research-runs"] });
      await client.invalidateQueries({ queryKey: ["admin-research-connector-health"] });
      await client.invalidateQueries({ queryKey: QUERY_KEYS.adminResearchDashboard });
    },
  });
}

export function useRetryAdminResearchRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => retryAdminResearchRun(runId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-research-runs"] });
    },
  });
}

export function useCancelAdminResearchRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => cancelAdminResearchRun(runId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-research-runs"] });
    },
  });
}

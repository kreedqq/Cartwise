import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  applyHistoricalKitRecovery,
  evaluateHistoricalKitRecovery,
} from "@/services/adminHistoricalKitRecovery";

export function useHistoricalKitRecoveryPreview(
  orderId: string | undefined,
  kitShareId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.historicalKitRecoveryPreview(orderId ?? "", kitShareId ?? ""),
    queryFn: () =>
      evaluateHistoricalKitRecovery({
        orderId: orderId as string,
        kitShareId: kitShareId as string,
      }),
    enabled: Boolean(orderId && kitShareId && enabled),
    staleTime: 0,
    retry: false,
  });
}

export function useApplyHistoricalKitRecovery(orderId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kitShareId: string; expectedRevision: number; reason: string }) =>
      applyHistoricalKitRecovery({
        orderId: orderId as string,
        kitShareId: input.kitShareId,
        expectedRevision: input.expectedRevision,
        reason: input.reason,
      }),
    onSuccess: () => {
      if (!orderId) return;
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderRevisions(orderId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderItems });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminRoleSurcharges });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKitOrderContext });
    },
  });
}

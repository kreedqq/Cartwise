import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  applyOrderCorrection,
  listOrderRevisions,
  type OrderLineChangeInput,
} from "@/services/adminOrderCorrection";

export function useOrderRevisions(orderId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orderRevisions(orderId ?? ""),
    queryFn: () => listOrderRevisions(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useApplyOrderCorrection(orderId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      expectedRevision: number;
      reason: string;
      lineChanges: OrderLineChangeInput[];
    }) =>
      applyOrderCorrection({
        orderId: orderId as string,
        expectedRevision: input.expectedRevision,
        reason: input.reason,
        lineChanges: input.lineChanges,
      }),
    onSuccess: () => {
      if (!orderId) return;
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderRevisions(orderId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderItems });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminRoleSurcharges });
    },
  });
}

/** Original submit total: first revision previous_total or current if never corrected. */
export function originalOrderTotalUsd(
  order: { total_usd: number; revision_number?: number },
  revisions: { revision_number: number; previous_total_usd: number }[],
): number {
  if (revisions.length === 0) return order.total_usd;
  const first = revisions.reduce((min, r) => (r.revision_number < min.revision_number ? r : min));
  return first.previous_total_usd;
}

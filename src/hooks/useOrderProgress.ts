import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { getOrderProgress, listAdminOrderProgress, upsertOrderProgress } from "@/services/orderProgress";
import type { OrderProgressStatusKey } from "@/lib/orderProgress";

export function useOrderProgress(orderId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orderProgress(orderId ?? ""),
    queryFn: () => getOrderProgress(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useAdminOrderProgressMap() {
  return useQuery({
    queryKey: QUERY_KEYS.adminOrderProgress,
    queryFn: listAdminOrderProgress,
    select: (rows) => new Map(rows.map((row) => [row.order_id, row])),
  });
}

export function useUpsertOrderProgress(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      statusKey: OrderProgressStatusKey;
      progressPercent: number;
      comment: string | null;
      title: string | null;
    }) => upsertOrderProgress({ orderId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderProgress(orderId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderProgress });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
  });
}

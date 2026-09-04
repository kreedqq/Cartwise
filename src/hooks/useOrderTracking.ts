import { useMutation, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { invokeTrackingEmail, saveOrderTrackingAndNotify, upsertOrderTracking } from "@/services/orderTracking";
import type { TrackingCarrierKey } from "@/lib/tracking";

export function useSaveOrderTracking(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      trackingNumber: string | null;
      trackingCarrier: TrackingCarrierKey | null;
      trackingUrl?: string | null;
      previous: {
        tracking_number?: string | null;
        tracking_notification_sent_at?: string | null;
      };
    }) => saveOrderTrackingAndNotify({ orderId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
  });
}

export function useTestTrackingEmail(orderId: string) {
  return useMutation({
    mutationFn: () => invokeTrackingEmail(orderId, { test: true }),
  });
}

export function useUpsertOrderTrackingOnly(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      trackingNumber: string | null;
      trackingCarrier: TrackingCarrierKey | null;
      trackingUrl?: string | null;
    }) => upsertOrderTracking({ orderId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
    },
  });
}

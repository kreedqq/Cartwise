import { useMutation, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { restoreKitShareCartLine } from "@/services/kitCartRestore";

type Options = {
  orderId?: string;
  /** Invalidate this user's cart queries after self-restore (Kit dialog). */
  viewerUserId?: string;
};

export function useRestoreKitShareCartLine(options: Options = {}) {
  const queryClient = useQueryClient();
  const { orderId, viewerUserId } = options;

  return useMutation({
    mutationFn: (input: { kitShareId: string; participantUserId: string }) =>
      restoreKitShareCartLine(input.kitShareId, input.participantUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKitOrderContext });
      if (orderId) {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      }
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      if (viewerUserId) {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(viewerUserId) });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartSummaries(viewerUserId) });
      }
    },
  });
}

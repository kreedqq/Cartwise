import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import type { KitRequestSort } from "@/lib/kitRequests";
import {
  cancelKitRequest,
  createKitRequest,
  joinKitRequest,
  leaveKitRequest,
  listMyKitRequestParticipations,
  listMyKitRequests,
  listOpenKitRequests,
  syncCompletedKitRequestCarts,
} from "@/services/kitRequests";

export interface OpenKitRequestFilters {
  search: string;
  category: string | null;
  productName: string | null;
  productId: string | null;
  variant: string | null;
  minRemaining: number | null;
  sort: KitRequestSort;
  page: number;
}

export function useOpenKitRequests(filters: OpenKitRequestFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.kitRequests(filters),
    queryFn: () =>
      listOpenKitRequests({
        search: filters.search.trim() || null,
        category: filters.category,
        productId: filters.productId,
        productName: filters.productName,
        variant: filters.variant,
        minRemaining: filters.minRemaining,
        sort: filters.sort,
        page: filters.page,
        pageSize: 20,
      }),
  });
}

export function useMyKitRequests() {
  return useQuery({
    queryKey: QUERY_KEYS.myKitRequests,
    queryFn: listMyKitRequests,
  });
}

export function useMyKitRequestParticipations() {
  return useQuery({
    queryKey: QUERY_KEYS.myKitRequestParticipations,
    queryFn: listMyKitRequestParticipations,
  });
}

export function useInvalidateKitRequests() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["kit-requests"] });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myKitRequests });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myKitRequestParticipations });
    void queryClient.invalidateQueries({ queryKey: ["carts"] });
    void queryClient.invalidateQueries({ queryKey: ["cart-summaries"] });
  };
}

export function useCreateKitRequest() {
  const invalidate = useInvalidateKitRequests();
  return useMutation({
    mutationFn: createKitRequest,
    onSuccess: () => invalidate(),
  });
}

export function useJoinKitRequest() {
  const invalidate = useInvalidateKitRequests();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => joinKitRequest(id, quantity),
    onSuccess: () => invalidate(),
  });
}

export function useLeaveKitRequest() {
  const invalidate = useInvalidateKitRequests();
  return useMutation({
    mutationFn: leaveKitRequest,
    onSuccess: () => invalidate(),
  });
}

export function useCancelKitRequest() {
  const invalidate = useInvalidateKitRequests();
  return useMutation({
    mutationFn: cancelKitRequest,
    onSuccess: () => invalidate(),
  });
}

export function useSyncKitRequestCarts() {
  const invalidate = useInvalidateKitRequests();
  return useMutation({
    mutationFn: syncCompletedKitRequestCarts,
    onSuccess: () => invalidate(),
  });
}

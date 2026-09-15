import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  adminCancelKitRequest,
  adminDeleteKitRequest,
  adminGetKitRequest,
  adminListKitRequests,
  adminSearchKitRequestUsers,
  adminSetKitRequestDistribution,
  adminSyncKitFullOrders,
  adminUpdateKitRequestMeta,
  type AdminKitRequestDetail,
  type AdminKitRequestStatusFilter,
} from "@/services/adminKitRequests";

export function useAdminKitRequests(filters: {
  status: AdminKitRequestStatusFilter;
  shopArea: string | null;
  search: string;
  page: number;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.adminKitRequests(filters),
    queryFn: () =>
      adminListKitRequests({
        status: filters.status,
        shopArea: filters.shopArea,
        search: filters.search.trim() || null,
        page: filters.page,
        pageSize: 30,
      }),
  });
}

export function useAdminKitRequest(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.adminKitRequest(id ?? ""),
    queryFn: () => adminGetKitRequest(id!),
    enabled: Boolean(id),
  });
}

function useInvalidateAdminKitRequests() {
  const queryClient = useQueryClient();
  return (detail?: AdminKitRequestDetail | { id: string }) => {
    if (detail && "participants" in detail) {
      queryClient.setQueryData(QUERY_KEYS.adminKitRequest(detail.id), detail);
    }
    void queryClient.invalidateQueries({ queryKey: ["admin-kit-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["kit-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["carts"] });
  };
}

export function useAdminUpdateKitRequestMeta() {
  const invalidate = useInvalidateAdminKitRequests();
  return useMutation({
    mutationFn: adminUpdateKitRequestMeta,
    onSuccess: (detail) => invalidate(detail),
  });
}

export function useAdminSetKitRequestDistribution() {
  const invalidate = useInvalidateAdminKitRequests();
  return useMutation({
    mutationFn: adminSetKitRequestDistribution,
    onSuccess: (detail) => invalidate(detail),
  });
}

export function useAdminSyncKitFullOrders() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAdminKitRequests();
  return useMutation({
    mutationFn: adminSyncKitFullOrders,
    onSuccess: (detail) => {
      invalidate(detail);
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useAdminSearchKitRequestUsers(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["admin-kit-request-user-search", query],
    queryFn: () => adminSearchKitRequestUsers(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useAdminCancelKitRequest() {
  const invalidate = useInvalidateAdminKitRequests();
  return useMutation({
    mutationFn: adminCancelKitRequest,
    onSuccess: (detail) => invalidate(detail),
  });
}

export function useAdminDeleteKitRequest() {
  const invalidate = useInvalidateAdminKitRequests();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminDeleteKitRequest,
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.adminKitRequest(result.id) });
      invalidate({ id: result.id });
    },
  });
}

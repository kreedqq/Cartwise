import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  adminCancelKitRequest,
  adminGetKitRequest,
  adminListKitRequests,
  adminUpdateKitRequestMeta,
  adminUpdateKitRequestParticipantQuantity,
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
  return (detail?: AdminKitRequestDetail) => {
    if (detail) {
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

export function useAdminUpdateKitRequestParticipantQuantity() {
  const invalidate = useInvalidateAdminKitRequests();
  return useMutation({
    mutationFn: adminUpdateKitRequestParticipantQuantity,
    onSuccess: (detail) => invalidate(detail),
  });
}

export function useAdminCancelKitRequest() {
  const invalidate = useInvalidateAdminKitRequests();
  return useMutation({
    mutationFn: adminCancelKitRequest,
    onSuccess: (detail) => invalidate(detail),
  });
}

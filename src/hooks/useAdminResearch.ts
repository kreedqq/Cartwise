import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { ADMIN_RESEARCH_PAGE_SIZE, type ReviewQueueKind } from "@/lib/peptide/adminResearch";
import {
  fetchAdminResearchDashboard,
  fetchProductMappings,
  fetchReviewItemDetail,
  fetchReviewQueue,
  submitAdminReview,
  type ReviewItemDetail,
} from "@/services/adminResearch";
import type { AdminReviewAction } from "@/lib/peptide/adminResearch";

export function useAdminResearchDashboard() {
  const { isAdmin, loading } = useAuth();
  return useQuery({
    queryKey: QUERY_KEYS.adminResearchDashboard,
    queryFn: fetchAdminResearchDashboard,
    enabled: isAdmin && !loading,
    retry: 0,
  });
}

export function useAdminReviewQueue(kind: ReviewQueueKind, page: number) {
  const { isAdmin, loading } = useAuth();
  return useQuery({
    queryKey: QUERY_KEYS.adminResearchQueue(kind, page),
    queryFn: () => fetchReviewQueue(kind, page, ADMIN_RESEARCH_PAGE_SIZE),
    enabled: isAdmin && !loading,
    retry: 0,
  });
}

export function useAdminReviewDetail(kind: ReviewQueueKind | null, id: string | null) {
  const { isAdmin, loading } = useAuth();
  return useQuery({
    queryKey: QUERY_KEYS.adminResearchDetail(kind ?? "evidence", id ?? ""),
    enabled: Boolean(kind && id) && isAdmin && !loading,
    queryFn: () => fetchReviewItemDetail(kind!, id!),
    retry: 0,
  });
}

export function useAdminProductMappings(page: number) {
  const { isAdmin, loading } = useAuth();
  return useQuery({
    queryKey: QUERY_KEYS.adminResearchMappings(page),
    queryFn: () => fetchProductMappings(page, ADMIN_RESEARCH_PAGE_SIZE),
    enabled: isAdmin && !loading,
    retry: 0,
  });
}

export function useSubmitAdminReview() {
  const { isAdmin, user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: ReviewQueueKind;
      id: string;
      stableKey: string;
      action: AdminReviewAction;
      previousStatus: string | null;
      reason: string;
    }) =>
      submitAdminReview({
        ...input,
        isAdmin,
        adminUserId: user?.id ?? null,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: QUERY_KEYS.adminResearchDashboard });
      await client.invalidateQueries({ queryKey: ["admin-research-queue"] });
      await client.invalidateQueries({ queryKey: ["admin-research-detail"] });
    },
  });
}

export type { ReviewItemDetail };

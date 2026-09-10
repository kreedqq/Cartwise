import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { FEEDBACK_PAGE_SIZE } from "@/lib/feedback";
import {
  adminDeleteFeedback,
  adminRemoveFeedbackImage,
  adminUpdateFeedback,
  createOrderFeedback,
  feedbackImageUrl,
  listAdminFeedback,
  listApprovedFeedback,
  listApprovedFeedbackRatings,
  listMyFeedback,
  updateMyFeedback,
  type FeedbackInput,
  type OrderFeedback,
} from "@/services/feedback";
import { getSiteDesignSettings, saveSiteDesignSettings } from "@/services/siteDesign";
import type { SiteDesignConfig } from "@/lib/siteDesign";

export function useSiteDesign() {
  return useQuery({ queryKey: QUERY_KEYS.siteDesign, queryFn: getSiteDesignSettings });
}

export function useSaveSiteDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled: boolean; config: SiteDesignConfig }) => saveSiteDesignSettings(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.siteDesign });
    },
  });
}

export function useApprovedFeedback(page: number) {
  return useQuery({
    queryKey: QUERY_KEYS.approvedFeedback(page),
    queryFn: () => listApprovedFeedback(0, FEEDBACK_PAGE_SIZE * (page + 1)),
  });
}

export function useFeedbackStats() {
  return useQuery({
    queryKey: QUERY_KEYS.feedbackStats,
    queryFn: listApprovedFeedbackRatings,
  });
}

export function useMyFeedback() {
  return useQuery({ queryKey: QUERY_KEYS.myFeedback, queryFn: listMyFeedback });
}

export function useAdminFeedback() {
  return useQuery({ queryKey: QUERY_KEYS.adminFeedback({}), queryFn: listAdminFeedback });
}

export function useFeedbackImage(path: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.feedbackImage(path ?? ""),
    queryFn: () => feedbackImageUrl(path ?? null),
    enabled: Boolean(path),
  });
}

function useInvalidateFeedback() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myFeedback });
    void queryClient.invalidateQueries({ queryKey: ["approved-feedback"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.feedbackStats });
  };
}

export function useCreateFeedback() {
  const invalidate = useInvalidateFeedback();
  return useMutation({
    mutationFn: (input: FeedbackInput & { imageFile?: File | null }) => createOrderFeedback(input),
    onSuccess: invalidate,
  });
}

export function useUpdateMyFeedback() {
  const invalidate = useInvalidateFeedback();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<FeedbackInput> }) => updateMyFeedback(id, input),
    onSuccess: invalidate,
  });
}

export function useAdminUpdateFeedback() {
  const invalidate = useInvalidateFeedback();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<OrderFeedback, "status" | "is_featured" | "body" | "display_name" | "image_path" | "rating">>;
    }) => adminUpdateFeedback(id, patch),
    onSuccess: invalidate,
  });
}

export function useAdminDeleteFeedback() {
  const invalidate = useInvalidateFeedback();
  return useMutation({
    mutationFn: (row: OrderFeedback) => adminDeleteFeedback(row),
    onSuccess: invalidate,
  });
}

export function useAdminRemoveFeedbackImage() {
  const invalidate = useInvalidateFeedback();
  return useMutation({
    mutationFn: (row: OrderFeedback) => adminRemoveFeedbackImage(row),
    onSuccess: invalidate,
  });
}

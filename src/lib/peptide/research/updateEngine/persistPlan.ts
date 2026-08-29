import { isPublicSource, isPublicStudy } from "@/lib/peptide/lexicon/publicVisibility";
import type { ReviewCandidate } from "@/lib/peptide/research/updateEngine/types";

export function persistPlanFromRun(candidates: ReviewCandidate[]) {
  const review = candidates.filter(
    (row) => row.disposition === "NEW" || row.disposition === "UPDATED" || row.disposition === "REVIEW_REQUIRED",
  );
  return {
    productionWrite: false as const,
    autoApprove: false as const,
    claimsAdded: 0 as const,
    evidenceUpgraded: 0 as const,
    regulatoryAutoApproved: 0 as const,
    sources: review.filter((row) => row.kind === "source").map((row) => ({
      ...row,
      reviewStatus: "review-required" as const,
    })),
    studies: review.filter((row) => row.kind === "study").map((row) => ({
      ...row,
      reviewStatus: "review-required" as const,
    })),
    regulatory: review.filter((row) => row.kind === "regulatory").map((row) => ({
      ...row,
      reviewStatus: "review-required" as const,
      region: row.record.regulatory?.region ?? null,
    })),
  };
}

export function candidateIsPublic(candidate: ReviewCandidate): boolean {
  if (candidate.kind === "study" && candidate.record.nctId) {
    return isPublicStudy({
      nct_id: candidate.record.nctId,
      substanceCount: 1,
      review_status: candidate.reviewStatus,
    });
  }
  return isPublicSource({
    nct_id: candidate.record.nctId,
    review_status: candidate.reviewStatus,
  });
}

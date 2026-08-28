import type { WorkflowStatus } from "@/lib/peptide/adminResearch/workflow";

export type ReviewQueueKind = "evidence" | "regulatory" | "claim" | "substance";

export interface ReviewQueueItem {
  kind: ReviewQueueKind;
  id: string;
  stableKey: string;
  substanceSlug: string;
  title: string;
  status: WorkflowStatus | string;
  note: string | null;
  sourceCount: number;
}

export interface AdminResearchDashboard {
  source: "postgres" | "legacy-fallback";
  substances: number;
  sources: number;
  studies: number;
  claims: number;
  claimsApproved: number;
  claimsRejected: number;
  claimsReviewRequired: number;
  evidenceReviewRequired: number;
  evidenceApproved: number;
  evidenceRejected: number;
  regulatoryReviewRequired: number;
  regulatoryApproved: number;
  reviewActions: number;
  researchUpdates: number;
  communityReports: number;
}

export function emptyDashboard(source: AdminResearchDashboard["source"]): AdminResearchDashboard {
  return {
    source,
    substances: 0,
    sources: 0,
    studies: 0,
    claims: 0,
    claimsApproved: 0,
    claimsRejected: 0,
    claimsReviewRequired: 0,
    evidenceReviewRequired: 0,
    evidenceApproved: 0,
    evidenceRejected: 0,
    regulatoryReviewRequired: 0,
    regulatoryApproved: 0,
    reviewActions: 0,
    researchUpdates: 0,
    communityReports: 0,
  };
}

export function openSubstanceReviews(
  actions: Array<{
    entity_type: string;
    entity_stable_key: string | null;
    action: string;
    created_at: string;
    reason: string | null;
    id: string;
  }>,
): ReviewQueueItem[] {
  const latest = new Map<string, (typeof actions)[number]>();
  const sorted = [...actions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const row of sorted) {
    if (row.entity_type !== "substance" || !row.entity_stable_key) continue;
    latest.set(row.entity_stable_key, row);
  }
  return [...latest.entries()]
    .filter(([, row]) => row.action === "request_review")
    .map(([slug, row]) => ({
      kind: "substance" as const,
      id: row.id,
      stableKey: slug,
      substanceSlug: slug,
      title: slug,
      status: "review-required",
      note: row.reason,
      sourceCount: 0,
    }));
}

export function claimIsTraceable(sourceIds: readonly string[]): boolean {
  return sourceIds.length > 0;
}

export const ADMIN_RESEARCH_PAGE_SIZE = 20;

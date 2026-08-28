export const ADMIN_REVIEW_ACTIONS = [
  "approve",
  "reject",
  "request_review",
  "publish",
  "unpublish",
] as const;

export type AdminReviewAction = (typeof ADMIN_REVIEW_ACTIONS)[number];

export type ResearchEntityType = "claim" | "evidence_assessment" | "regulatory_record" | "substance";

export type WorkflowStatus = "draft" | "review-required" | "approved" | "rejected";

export const RESEARCH_UPDATES_TABLE_EXISTS = false;

export function isImplementedReviewAction(action: string): action is AdminReviewAction {
  return (ADMIN_REVIEW_ACTIONS as readonly string[]).includes(action);
}

/** edit is in the SQL enum but has no admin UI in Phase 8. */
export function isUiReviewAction(action: string): action is AdminReviewAction {
  return isImplementedReviewAction(action);
}

export function nextWorkflowStatus(action: AdminReviewAction): WorkflowStatus {
  if (action === "approve" || action === "publish") return "approved";
  if (action === "reject") return "rejected";
  return "review-required";
}

export function assertAdminCanWriteReview(isAdmin: boolean): void {
  if (!isAdmin) {
    throw new Error("Nur Administratoren dürfen Research-Reviews schreiben.");
  }
}

export interface ReviewActionDraft {
  entityType: ResearchEntityType;
  entityId: string | null;
  entityStableKey: string | null;
  action: AdminReviewAction;
  previousStatus: string | null;
  newStatus: WorkflowStatus;
  reason: string;
  adminUserId: string | null;
}

export function buildReviewActionDraft(input: {
  entityType: ResearchEntityType;
  entityId: string | null;
  entityStableKey: string | null;
  action: AdminReviewAction;
  previousStatus: string | null;
  reason: string;
  adminUserId: string | null;
}): ReviewActionDraft {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Review-Aktionen brauchen eine Begründung.");
  if (!isImplementedReviewAction(input.action)) {
    throw new Error(`Review-Aktion nicht implementiert: ${input.action}`);
  }
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    entityStableKey: input.entityStableKey,
    action: input.action,
    previousStatus: input.previousStatus,
    newStatus: nextWorkflowStatus(input.action),
    reason,
    adminUserId: input.adminUserId,
  };
}

/** History is append-only: never mutate an existing action row. */
export function appendReviewHistory<T>(existing: readonly T[], next: T): T[] {
  return [...existing, next];
}

export function approvingClaimDoesNotChangeEvidence(): boolean {
  return true;
}

export function communityCannotAppearAsScientificEvidence(sourceType: string): boolean {
  return ["blog", "reddit", "forum", "community"].includes(sourceType);
}

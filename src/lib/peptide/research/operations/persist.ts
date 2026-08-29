import { sourceLookupKeys } from "@/lib/peptide/research/updateEngine/normalize";
import type { ReviewCandidate } from "@/lib/peptide/research/updateEngine/types";
import { isPersistedUuid, nextOperationsUuid } from "@/lib/peptide/research/operations/ids";
import { isIntakePlaceholderId } from "@/lib/peptide/research/batch03Intake";
import {
  assertAdminCanWriteReview,
  buildReviewActionDraft,
  nextWorkflowStatus,
  type AdminReviewAction,
} from "@/lib/peptide/adminResearch/workflow";
import type { OperationsSource, OperationsStore, OperationsStudy } from "@/lib/peptide/research/operations/types";

export interface CandidatePersistResult {
  productionWrite: false;
  claimsAdded: 0;
  evidenceUpgraded: 0;
  regulatoryAutoApproved: 0;
  sourcesInserted: number;
  sourcesUpdated: number;
  sourcesUnchanged: number;
  studiesInserted: number;
  studiesUpdated: number;
  createdSourceIds: string[];
  updatedSourceIds: string[];
  createdStudyIds: string[];
  updatedStudyIds: string[];
}

function findSource(store: OperationsStore, candidate: ReviewCandidate): OperationsSource | undefined {
  const keys = new Set(sourceLookupKeys(candidate.record));
  return store.sources.find((row) =>
    sourceLookupKeys({
      pmid: row.pmid,
      doi: row.doi,
      nctId: row.nctId,
      connector: row.connector ?? undefined,
    }).some((key) => keys.has(key)),
  );
}

function findStudy(store: OperationsStore, nctId: string | null): OperationsStudy | undefined {
  if (!nctId) return undefined;
  return store.studies.find((row) => row.nctId === nctId);
}

export function persistReviewCandidates(
  store: OperationsStore,
  candidates: ReviewCandidate[],
  options: { persist: boolean },
): CandidatePersistResult {
  const result: CandidatePersistResult = {
    productionWrite: false,
    claimsAdded: 0,
    evidenceUpgraded: 0,
    regulatoryAutoApproved: 0,
    sourcesInserted: 0,
    sourcesUpdated: 0,
    sourcesUnchanged: 0,
    studiesInserted: 0,
    studiesUpdated: 0,
    createdSourceIds: [],
    updatedSourceIds: [],
    createdStudyIds: [],
    updatedStudyIds: [],
  };
  if (!options.persist) return result;

  for (const candidate of candidates) {
    if (candidate.kind === "regulatory") continue;
    if (candidate.disposition === "UNCHANGED" || candidate.disposition === "DUPLICATE") {
      // Preserve approved / review-required / rejected. No field write, no status change.
      if (candidate.kind === "source") result.sourcesUnchanged += 1;
      continue;
    }
    if (candidate.disposition === "REJECTED") continue;

    if (candidate.kind === "study") {
      const nctId = candidate.record.study?.nctId ?? candidate.record.nctId;
      if (!nctId) continue;
      const existing = findStudy(store, nctId);
      if (existing) {
        existing.previousTitle = existing.title;
        existing.previousStatus = existing.status;
        existing.title = candidate.record.study?.title ?? candidate.record.title;
        existing.status = candidate.record.study?.status ?? existing.status;
        existing.reviewStatus = "review-required";
        result.studiesUpdated += 1;
        result.updatedStudyIds.push(existing.id);
      } else {
        const created: OperationsStudy = {
          id: nextOperationsUuid(),
          nctId,
          title: candidate.record.study?.title ?? candidate.record.title,
          status: candidate.record.study?.status ?? null,
          sponsor: candidate.record.study?.sponsor ?? null,
          phase: candidate.record.study?.phase ?? null,
          reviewStatus: "review-required",
        };
        store.studies.push(created);
        store.studySubstances.push({ studyId: created.id, slug: candidate.slug });
        result.studiesInserted += 1;
        result.createdStudyIds.push(created.id);
      }
      continue;
    }

    const existing = findSource(store, candidate);
    if (existing) {
      if (candidate.disposition === "UPDATED" || candidate.disposition === "REVIEW_REQUIRED") {
        existing.previousTitle = existing.title;
        existing.previousPublicationDate = existing.publicationDate;
        existing.title = candidate.record.title;
        existing.publicationDate = candidate.record.publicationDate;
        existing.reviewStatus = "review-required";
        result.sourcesUpdated += 1;
        result.updatedSourceIds.push(existing.id);
      } else {
        result.sourcesUnchanged += 1;
      }
      if (!store.sourceSubstances.some((row) => row.sourceId === existing.id && row.slug === candidate.slug)) {
        store.sourceSubstances.push({ sourceId: existing.id, slug: candidate.slug });
      }
      continue;
    }

    const created: OperationsSource = {
      id: nextOperationsUuid(),
      sourceType: candidate.record.sourceType,
      title: candidate.record.title,
      publisher: candidate.record.publisher,
      publicationDate: candidate.record.publicationDate,
      url: candidate.record.url,
      doi: candidate.record.doi,
      pmid: candidate.record.pmid,
      nctId: candidate.record.nctId,
      status: "active",
      reviewStatus: "review-required",
      connector: candidate.record.connector,
    };
    store.sources.push(created);
    store.sourceSubstances.push({ sourceId: created.id, slug: candidate.slug });
    result.sourcesInserted += 1;
    result.createdSourceIds.push(created.id);
  }

  return result;
}

export function applySourceReview(input: {
  store: OperationsStore;
  isAdmin: boolean;
  adminUserId: string | null;
  id: string;
  action: AdminReviewAction;
  reason: string;
  now?: string;
}): OperationsSource {
  return applyEntityReview(input, "source") as OperationsSource;
}

export function applyStudyReview(input: {
  store: OperationsStore;
  isAdmin: boolean;
  adminUserId: string | null;
  id: string;
  action: AdminReviewAction;
  reason: string;
  now?: string;
}): OperationsStudy {
  return applyEntityReview(input, "study") as OperationsStudy;
}

function applyEntityReview(
  input: {
    store: OperationsStore;
    isAdmin: boolean;
    adminUserId: string | null;
    id: string;
    action: AdminReviewAction;
    reason: string;
    now?: string;
  },
  kind: "source" | "study",
) {
  assertAdminCanWriteReview(input.isAdmin);
  if (isIntakePlaceholderId(input.id) || !isPersistedUuid(input.id)) {
    throw new Error("Approve/Reject nur für persistierte UUID-Datensätze.");
  }
  if (kind === "source") {
    const row = input.store.sources.find((item) => item.id === input.id);
    if (!row) throw new Error("Source nicht gefunden.");
    const previous = row.reviewStatus;
    row.reviewStatus = nextWorkflowStatus(input.action);
    appendAction(input, "source", previous);
    return row;
  }
  const row = input.store.studies.find((item) => item.id === input.id);
  if (!row) throw new Error("Study nicht gefunden.");
  const previous = row.reviewStatus;
  row.reviewStatus = nextWorkflowStatus(input.action);
  appendAction(input, "study", previous);
  return row;
}

function appendAction(
  input: {
    store: OperationsStore;
    adminUserId: string | null;
    id: string;
    action: AdminReviewAction;
    reason: string;
    now?: string;
  },
  entityType: "source" | "study",
  previousStatus: string,
): void {
  const draft = buildReviewActionDraft({
    entityType,
    entityId: input.id,
    entityStableKey: input.id,
    action: input.action,
    previousStatus,
    reason: input.reason,
    adminUserId: input.adminUserId,
  });
  input.store.reviewActions.push({
    id: nextOperationsUuid(),
    adminUserId: draft.adminUserId,
    entityType,
    entityId: input.id,
    action: draft.action,
    previousStatus: draft.previousStatus,
    newStatus: draft.newStatus,
    reason: draft.reason,
    createdAt: input.now ?? "2026-08-29T00:00:00.000Z",
  });
}

export function inventoryUnchanged(store: OperationsStore): boolean {
  return (
    store.inventory.claims === 294 &&
    store.inventory.evidence === 294 &&
    store.inventory.evidenceReviewRequired === 267 &&
    store.inventory.evidenceApproved === 27 &&
    store.inventory.regulatory === 41
  );
}

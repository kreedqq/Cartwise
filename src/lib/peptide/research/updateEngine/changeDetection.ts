import { sourceLookupKeys, stableSourceKey } from "@/lib/peptide/research/updateEngine/normalize";
import type {
  ChangeDisposition,
  ConnectorSourceRecord,
  ExistingSourceRow,
  ExistingStudyRow,
} from "@/lib/peptide/research/updateEngine/types";

export type WorkflowReviewStatus = "draft" | "review-required" | "approved" | "rejected";

export function normalizeComparableText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeComparableDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export function scientificSourceFieldsChanged(
  previous: { title: string; publicationDate: string | null },
  next: { title: string; publicationDate: string | null },
): boolean {
  return (
    normalizeComparableText(previous.title) !== normalizeComparableText(next.title) ||
    normalizeComparableDate(previous.publicationDate) !== normalizeComparableDate(next.publicationDate)
  );
}

export function scientificStudyFieldsChanged(
  previous: { title: string; status: string | null },
  next: { title: string; status: string | null },
): boolean {
  return (
    normalizeComparableText(previous.title) !== normalizeComparableText(next.title) ||
    normalizeComparableText(previous.status) !== normalizeComparableText(next.status)
  );
}

export function detectSourceChange(
  record: ConnectorSourceRecord,
  existing: ExistingSourceRow[],
  seenKeys: Set<string>,
): { disposition: ChangeDisposition; previous?: ExistingSourceRow; key: string } {
  const key = stableSourceKey(record);
  if (seenKeys.has(key)) {
    return { disposition: "DUPLICATE", key };
  }
  const keys = new Set(sourceLookupKeys(record));
  const match = existing.find((row) => sourceLookupKeys(row).some((item) => keys.has(item)));
  if (!match) {
    return { disposition: "NEW", key };
  }
  if (
    scientificSourceFieldsChanged(
      { title: match.title, publicationDate: match.publicationDate },
      { title: record.title, publicationDate: record.publicationDate },
    )
  ) {
    return { disposition: "UPDATED", previous: match, key };
  }
  return { disposition: "UNCHANGED", previous: match, key };
}

export function detectStudyChange(
  nctId: string,
  title: string,
  status: string | null,
  existing: ExistingStudyRow[],
  seenNcts: Set<string>,
): { disposition: ChangeDisposition; previous?: ExistingStudyRow } {
  if (seenNcts.has(nctId)) return { disposition: "DUPLICATE" };
  const match = existing.find((row) => row.nctId === nctId);
  if (!match) return { disposition: "NEW" };
  if (scientificStudyFieldsChanged({ title: match.title, status: match.status }, { title, status })) {
    return { disposition: "UPDATED", previous: match };
  }
  return { disposition: "UNCHANGED", previous: match };
}

/** Review-queue flag for NEW / UPDATED / uncertain identity. Null means do not touch status. */
export function reviewStatusForDisposition(disposition: ChangeDisposition): "review-required" | null {
  if (disposition === "NEW" || disposition === "UPDATED" || disposition === "REVIEW_REQUIRED") {
    return "review-required";
  }
  return null;
}

export function persistTouchesReviewStatus(disposition: ChangeDisposition): boolean {
  return reviewStatusForDisposition(disposition) !== null;
}

export function preservedWorkflowStatus(
  disposition: ChangeDisposition,
  current: WorkflowReviewStatus | null | undefined,
): WorkflowReviewStatus {
  if (persistTouchesReviewStatus(disposition)) return "review-required";
  if (current === "approved" || current === "rejected" || current === "review-required" || current === "draft") {
    return current;
  }
  return "review-required";
}

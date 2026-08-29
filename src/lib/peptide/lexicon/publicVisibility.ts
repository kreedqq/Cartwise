import { isExcludedNct } from "@/lib/peptide/persistence/identifiers";
import {
  PUBLIC_CLAIM_STATUS,
  PUBLIC_REGULATORY_REVIEW_STATUS,
  PUBLIC_REVIEW_STATUS,
  type PublicLexiconBundle,
} from "@/lib/peptide/lexicon/types";

const HIDDEN_WORKFLOW = new Set(["draft", "review-required", "rejected", "unreviewed"]);

export function isHudsonSource(source: { nct_id: string | null; legacy_ids?: string[] }): boolean {
  if (isExcludedNct(source.nct_id)) return true;
  return (source.legacy_ids ?? []).some(
    (id) => isExcludedNct(id) || id.includes("NCT07487363") || id.includes("NCT07437560"),
  );
}

export function isPublicClaim(claim: {
  status: string;
  sourceCount: number;
}): boolean {
  if (HIDDEN_WORKFLOW.has(claim.status)) return false;
  if (claim.status !== PUBLIC_CLAIM_STATUS) return false;
  return claim.sourceCount > 0;
}

export function isPublicEvidence(row: { review_status: string }): boolean {
  if (HIDDEN_WORKFLOW.has(row.review_status)) return false;
  return row.review_status === PUBLIC_REVIEW_STATUS;
}

export function isPublicRegulatory(row: { review_status: string; is_current: boolean }): boolean {
  if (HIDDEN_WORKFLOW.has(row.review_status)) return false;
  if (row.review_status !== PUBLIC_REGULATORY_REVIEW_STATUS) return false;
  return row.is_current;
}

export function isPublicSource(source: {
  nct_id: string | null;
  legacy_ids?: string[];
  review_status?: string | null;
}): boolean {
  if (isHudsonSource(source)) return false;
  const status = source.review_status ?? PUBLIC_REVIEW_STATUS;
  if (HIDDEN_WORKFLOW.has(status)) return false;
  return status === PUBLIC_REVIEW_STATUS;
}

export function isPublicStudy(row: {
  nct_id: string;
  substanceCount: number;
  review_status?: string | null;
}): boolean {
  if (isExcludedNct(row.nct_id)) return false;
  const status = row.review_status ?? PUBLIC_REVIEW_STATUS;
  if (HIDDEN_WORKFLOW.has(status)) return false;
  if (status !== PUBLIC_REVIEW_STATUS) return false;
  return row.substanceCount > 0;
}

export function claimSourceCount(
  bundle: PublicLexiconBundle,
  claimId: string,
): number {
  const sourceById = new Map(bundle.sources.map((row) => [row.id, row]));
  return bundle.claimSources.filter((link) => {
    if (link.claim_id !== claimId) return false;
    const source = sourceById.get(link.source_id);
    if (!source) return false;
    return isPublicSource(source);
  }).length;
}

export function publicClaims(bundle: PublicLexiconBundle): PublicLexiconBundle["claims"] {
  return bundle.claims.filter((claim) =>
    isPublicClaim({ status: claim.status, sourceCount: claimSourceCount(bundle, claim.id) }),
  );
}

export function publicEvidence(bundle: PublicLexiconBundle): PublicLexiconBundle["evidence"] {
  return bundle.evidence.filter((row) => isPublicEvidence(row));
}

export function publicRegulatory(bundle: PublicLexiconBundle): PublicLexiconBundle["regulatory"] {
  return bundle.regulatory.filter((row) => isPublicRegulatory(row));
}

export function publicSources(bundle: PublicLexiconBundle): PublicLexiconBundle["sources"] {
  return bundle.sources.filter((source) => isPublicSource(source));
}

export function publicStudies(bundle: PublicLexiconBundle): PublicLexiconBundle["studies"] {
  return bundle.studies.filter((study) =>
    isPublicStudy({
      nct_id: study.nct_id,
      substanceCount: bundle.studySubstances.filter((link) => link.study_id === study.id).length,
      review_status: study.review_status,
    }),
  );
}

export function isPublicCommunityReport(row: { review_status?: string | null }): boolean {
  const status = row.review_status ?? "";
  if (HIDDEN_WORKFLOW.has(status)) return false;
  return status === PUBLIC_REVIEW_STATUS;
}

export function publicResponseHasAdminLeak(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return /review_actions|reviewActions|admin_user_id|internal_note|service_role/i.test(text);
}

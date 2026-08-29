import { isExcludedNct, normalizeNct } from "@/lib/peptide/persistence/identifiers";
import { isHudsonSponsor, keepStudy } from "@/lib/peptide/research/sourceValidation";
import type { ConnectorSourceRecord } from "@/lib/peptide/research/updateEngine/types";

/** TEST FIXTURE shape matches ClinicalTrials.gov API v2 compact cache. */
export function normalizeClinicalTrial(
  raw: unknown,
  context: { slug: string; now: string },
): ConnectorSourceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const nctId = normalizeNct(typeof row.nctId === "string" ? row.nctId : typeof row.nct_id === "string" ? row.nct_id : null);
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!nctId || !title) return null;
  const sponsor = typeof row.sponsor === "string" ? row.sponsor : null;
  const intervention = typeof row.intervention === "string" ? row.intervention : null;
  const condition = typeof row.condition === "string" ? row.condition : null;
  const phase = typeof row.phase === "string" ? row.phase : null;
  const status = typeof row.status === "string" ? row.status : null;
  return {
    sourceType: "clinical_trial",
    identifier: nctId,
    title,
    url: typeof row.url === "string" ? row.url : `https://clinicaltrials.gov/study/${nctId}`,
    publisher: "ClinicalTrials.gov",
    publicationDate: typeof row.lastUpdate === "string" ? row.lastUpdate : null,
    substanceCandidate: context.slug,
    rawMetadata: { nctId, sponsor, phase, status },
    retrievedAt: context.now,
    connector: "clinicaltrials",
    pmid: null,
    doi: null,
    nctId,
    authors: sponsor,
    study: {
      nctId,
      title,
      sponsor,
      intervention,
      condition,
      phase,
      status,
      startDate: typeof row.start === "string" ? row.start : null,
      completionDate: typeof row.completion === "string" ? row.completion : null,
    },
    regulatory: null,
  };
}

export function rejectClinicalTrial(slug: string, record: ConnectorSourceRecord): string | null {
  if (!record.nctId) return "missing-nct";
  if (isExcludedNct(record.nctId)) return "hudson-excluded";
  if (isHudsonSponsor(record.study?.sponsor)) return "hudson-sponsor";
  if (!keepStudy(slug, record.study ?? { nctId: record.nctId, title: record.title })) return "query-pollution";
  return null;
}

export function validateClinicalTrialRecord(record: ConnectorSourceRecord): { ok: boolean; message?: string } {
  if (record.connector !== "clinicaltrials") return { ok: false, message: "not-ctgov" };
  if (!record.nctId || !record.title || !record.url) return { ok: false, message: "incomplete" };
  return { ok: true };
}

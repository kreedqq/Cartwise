import { normalizeDoi, normalizeNct, normalizePmid } from "@/lib/peptide/persistence/identifiers";

export function researchSourceKey(source: {
  pmid?: string | null;
  doi?: string | null;
  nctId?: string | null;
  clinicalTrialId?: string | null;
  legacyId?: string | null;
  id?: string | null;
}): string {
  const pmid = normalizePmid(source.pmid);
  if (pmid) return `pmid:${pmid}`;
  const doi = normalizeDoi(source.doi);
  if (doi) return `doi:${doi}`;
  const nct = normalizeNct(source.nctId ?? source.clinicalTrialId);
  if (nct) return `nct:${nct}`;
  const id = source.legacyId ?? source.id ?? "";
  return `id:${id}`;
}

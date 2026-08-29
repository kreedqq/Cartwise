import { normalizeDoi, normalizeNct, normalizePmid } from "@/lib/peptide/persistence/identifiers";
import type { ConnectorSourceRecord } from "@/lib/peptide/research/updateEngine/types";

export function stableSourceKey(record: Pick<ConnectorSourceRecord, "pmid" | "doi" | "nctId" | "connector" | "identifier">): string {
  const pmid = normalizePmid(record.pmid);
  if (pmid) return `pmid:${pmid}`;
  const doi = normalizeDoi(record.doi);
  if (doi) return `doi:${doi}`;
  const nct = normalizeNct(record.nctId);
  if (nct) return `nct:${nct}`;
  return `${record.connector}:${record.identifier}`;
}

export function sourceLookupKeys(
  row: {
    pmid?: string | null;
    doi?: string | null;
    nctId?: string | null;
    nct_id?: string | null;
    legacyIds?: string[];
    identifier?: string;
    connector?: string;
  },
): string[] {
  const keys: string[] = [];
  const pmid = normalizePmid(row.pmid);
  if (pmid) keys.push(`pmid:${pmid}`);
  const doi = normalizeDoi(row.doi);
  if (doi) keys.push(`doi:${doi}`);
  const nct = normalizeNct(row.nctId ?? row.nct_id);
  if (nct) keys.push(`nct:${nct}`);
  for (const legacy of row.legacyIds ?? []) {
    if (legacy) keys.push(legacy);
  }
  if (row.connector && row.identifier) keys.push(`${row.connector}:${row.identifier}`);
  return keys;
}

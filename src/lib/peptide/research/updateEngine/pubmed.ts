import { normalizeDoi, normalizePmid } from "@/lib/peptide/persistence/identifiers";
import type { ConnectorSourceRecord } from "@/lib/peptide/research/updateEngine/types";

/** TEST FIXTURE shape matches NCBI ESummary compact cache, not a mock study. */
export function normalizePubmedArticle(
  raw: unknown,
  context: { slug: string; now: string },
): ConnectorSourceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const pmid = normalizePmid(typeof row.pmid === "string" || typeof row.pmid === "number" ? String(row.pmid) : null);
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!pmid || !title) return null;
  const doi = normalizeDoi(typeof row.doi === "string" ? row.doi : null);
  const authors = Array.isArray(row.authors)
    ? row.authors.map((item) => (typeof item === "string" ? item : (item as { name?: string }).name)).filter(Boolean).join(", ")
    : typeof row.authors === "string"
      ? row.authors
      : null;
  return {
    sourceType: "pubmed",
    identifier: pmid,
    title,
    url: typeof row.url === "string" ? row.url : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    publisher: typeof row.source === "string" ? row.source : typeof row.publisher === "string" ? row.publisher : "PubMed",
    publicationDate: typeof row.pubdate === "string" ? row.pubdate : typeof row.publicationDate === "string" ? row.publicationDate : null,
    substanceCandidate: context.slug,
    rawMetadata: { pmid, doi, authors, pubtype: row.pubtype ?? null },
    retrievedAt: context.now,
    connector: "pubmed",
    pmid,
    doi,
    nctId: null,
    authors,
    study: null,
    regulatory: null,
  };
}

export function validatePubmedRecord(record: ConnectorSourceRecord): { ok: boolean; message?: string } {
  if (record.connector !== "pubmed") return { ok: false, message: "not-pubmed" };
  if (!record.pmid || !record.title || !record.url) return { ok: false, message: "incomplete" };
  return { ok: true };
}

import type { ConnectorSourceRecord } from "@/lib/peptide/research/updateEngine/types";

export type FdaNormalizeResult =
  | { kind: "record"; record: ConnectorSourceRecord }
  | { kind: "empty-search"; notApproved: false; found: false }
  | { kind: "error"; message: string };

/**
 * Empty openFDA/Drugs@FDA search is not stored as not_approved.
 * TEST FIXTURES use the compact cache shape from scripts/fetch-research-sources.mjs.
 */
export function normalizeFdaResult(raw: unknown, context: { slug: string; now: string }): FdaNormalizeResult {
  if (!raw || typeof raw !== "object") return { kind: "error", message: "invalid-payload" };
  const row = raw as Record<string, unknown>;
  const status = typeof row.status === "number" ? row.status : null;
  const found = row.found === true;
  const products = Array.isArray(row.products) ? row.products : [];
  if (status === 404 || found === false || products.length === 0) {
    return { kind: "empty-search", notApproved: false, found: false };
  }
  const first = products[0] as Record<string, unknown>;
  const nested = Array.isArray(first.products) ? (first.products[0] as Record<string, unknown> | undefined) : undefined;
  const productName =
    (typeof nested?.brand === "string" ? nested.brand : null) ??
    (typeof first.sponsor === "string" ? first.sponsor : null);
  const application = typeof first.application === "string" ? first.application : null;
  const title = productName ? `FDA: ${productName}` : `FDA record for ${context.slug}`;
  return {
    kind: "record",
    record: {
      sourceType: "fda",
      identifier: application ?? `fda:${context.slug}`,
      title,
      url: "https://api.fda.gov/drug/drugsfda.json",
      publisher: "FDA",
      publicationDate: null,
      substanceCandidate: context.slug,
      rawMetadata: { application, found: true },
      retrievedAt: context.now,
      connector: "fda",
      pmid: null,
      doi: null,
      nctId: null,
      authors: null,
      study: null,
      regulatory: {
        authority: "fda",
        region: "US",
        productName,
        indication: null,
        status: typeof nested?.marketing === "string" ? nested.marketing : "found",
        applicationId: application,
        effectiveDate: null,
      },
    },
  };
}

export function validateFdaRecord(record: ConnectorSourceRecord): { ok: boolean; message?: string } {
  if (record.connector !== "fda") return { ok: false, message: "not-fda" };
  if (record.regulatory?.region !== "US") return { ok: false, message: "region-must-be-us" };
  if (!record.title || !record.url) return { ok: false, message: "incomplete" };
  return { ok: true };
}

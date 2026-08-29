import type { ConnectorSourceRecord } from "@/lib/peptide/research/updateEngine/types";

export type EmaNormalizeResult =
  | { kind: "record"; record: ConnectorSourceRecord }
  | { kind: "http-404"; storedAsEvidence: false }
  | { kind: "error"; message: string };

/**
 * EMA HTTP 404 is not stored as regulatory evidence.
 * TEST FIXTURES use { ok, status, url, productName } — never invented approvals.
 */
export function normalizeEmaResult(raw: unknown, context: { slug: string; now: string }): EmaNormalizeResult {
  if (!raw || typeof raw !== "object") return { kind: "error", message: "invalid-payload" };
  const row = raw as Record<string, unknown>;
  const status = typeof row.status === "number" ? row.status : null;
  if (status === 404 || row.ok === false) {
    return { kind: "http-404", storedAsEvidence: false };
  }
  const url = typeof row.url === "string" ? row.url : null;
  const productName = typeof row.productName === "string" ? row.productName : null;
  if (!url || !productName) return { kind: "error", message: "incomplete-ema" };
  return {
    kind: "record",
    record: {
      sourceType: "ema",
      identifier: `ema:${context.slug}:${productName.toLowerCase().replace(/\s+/g, "-")}`,
      title: `EMA: ${productName}`,
      url,
      publisher: "EMA",
      publicationDate: typeof row.date === "string" ? row.date : null,
      substanceCandidate: context.slug,
      rawMetadata: { productName, status },
      retrievedAt: context.now,
      connector: "ema",
      pmid: null,
      doi: null,
      nctId: null,
      authors: null,
      study: null,
      regulatory: {
        authority: "ema",
        region: "EU",
        productName,
        indication: typeof row.indication === "string" ? row.indication : null,
        status: typeof row.regulatoryStatus === "string" ? row.regulatoryStatus : "found",
        applicationId: null,
        effectiveDate: typeof row.date === "string" ? row.date : null,
      },
    },
  };
}

export function validateEmaRecord(record: ConnectorSourceRecord): { ok: boolean; message?: string } {
  if (record.connector !== "ema") return { ok: false, message: "not-ema" };
  if (record.regulatory?.region !== "EU") return { ok: false, message: "region-must-be-eu" };
  if (!record.title || !record.url) return { ok: false, message: "incomplete" };
  return { ok: true };
}

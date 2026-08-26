/**
 * State and derived values for the import preview, shared by the file-import
 * page and the CSV paste dialog.
 *
 * The admin never has to choose "create" or "update": the article code is the
 * key, so the only decision left is "import this row or skip it". What will
 * actually happen is derived here for display and finally re-resolved
 * server-side by apply_pdf_import, which closes the gap between building the
 * preview and applying it.
 */

import { buildImportRow, type ParsedProductImportRow } from "@/lib/productImportRow";
import type { ImportRowAction } from "@/types/database";

export interface ImportReviewRow extends ParsedProductImportRow {
  /** Only "auto" or "skip" are offered; the server resolves "auto" by code. */
  action: ImportRowAction;
  /** The product this code currently matches, or null for a new article. */
  targetProductId: string | null;
  /**
   * The numeric inputs as typed. Keeping the raw text means a half-typed
   * "55," survives a re-render instead of being rewritten to "55".
   */
  priceDraft: string;
  bulkPriceDraft: string;
  bulkMinDraft: string;
}

/** What the row will do once applied. */
export type ResolvedImportAction = "create" | "update" | "skip" | "error";

function draft(value: number | null): string {
  return value == null ? "" : String(value);
}

export function toReviewRow(
  parsed: ParsedProductImportRow,
  productIdByCode: Map<string, string>,
): ImportReviewRow {
  return {
    ...parsed,
    action: parsed.quality === "error" ? "skip" : "auto",
    targetProductId: parsed.parsedCode ? (productIdByCode.get(parsed.parsedCode) ?? null) : null,
    priceDraft: draft(parsed.parsedPriceUsd),
    bulkPriceDraft: draft(parsed.parsedBulkPriceUsd),
    bulkMinDraft: draft(parsed.parsedBulkPriceMinQuantity),
  };
}

export function toReviewRows(
  parsed: ParsedProductImportRow[],
  productIdByCode: Map<string, string>,
): ImportReviewRow[] {
  return parsed.map((row) => toReviewRow(row, productIdByCode));
}

/**
 * Applies one inline edit and re-runs validation, so the quality flag and the
 * import summary always describe what is currently on screen. Text fields are
 * re-validated from the drafts, so an unreadable number stays an error instead
 * of silently becoming null.
 */
export function applyRowEdit(
  row: ImportReviewRow,
  patch: Partial<ImportReviewRow>,
  productIdByCode: Map<string, string>,
): ImportReviewRow {
  const merged = { ...row, ...patch };

  const revalidated = buildImportRow(
    {
      code: merged.parsedCode,
      name: merged.parsedName,
      dosageVial: merged.parsedDosageVial,
      description: merged.parsedDescription,
      category: merged.parsedCategory,
      priceUsd: merged.priceDraft,
      bulkPriceUsd: merged.bulkPriceDraft,
      bulkPriceMinQuantity: merged.bulkMinDraft,
      isActive: merged.parsedIsActive == null ? null : String(merged.parsedIsActive),
    },
    merged.rowNumber,
    merged.rawText,
  );

  const code = revalidated.parsedCode;

  return {
    ...merged,
    ...revalidated,
    parsedIsActive: merged.parsedIsActive,
    targetProductId: code ? (productIdByCode.get(code) ?? null) : null,
  };
}

export function resolvedAction(row: ImportReviewRow): ResolvedImportAction {
  if (row.quality === "error") return "error";
  if (row.action === "skip") return "skip";
  return row.targetProductId ? "update" : "create";
}

export interface ImportReviewSummary {
  total: number;
  create: number;
  update: number;
  skip: number;
  error: number;
  /** Rows that will actually write something. */
  applicable: number;
}

export function summarizeReviewRows(rows: ImportReviewRow[]): ImportReviewSummary {
  const summary: ImportReviewSummary = { total: rows.length, create: 0, update: 0, skip: 0, error: 0, applicable: 0 };
  for (const row of rows) {
    const action = resolvedAction(row);
    summary[action] += 1;
  }
  summary.applicable = summary.create + summary.update;
  return summary;
}

/**
 * Rows in the shape applyImport expects. Rows with a parse error are sent as
 * explicit skips rather than dropped, so the import history records that they
 * existed and why they were not applied.
 */
export function toApplyPayload(rows: ImportReviewRow[]) {
  return rows.map((row) => ({
    ...row,
    action: (resolvedAction(row) === "error" || row.action === "skip" ? "skip" : "auto") as ImportRowAction,
  }));
}

/**
 * Vendor catalog matching logic.
 *
 * Each shop area is an independent vendor. The uploaded dealer file is the
 * only assortment source. This module maps parsed file rows onto the global
 * product master by normalized SKU — it never falls back to "all active products".
 *
 * No database calls. Used by AdminShopAreas and unit tests.
 */

import type { ParsedProductImportRow } from "@/lib/productImportRow";
import {
  parseImportedCategoryKey,
  type AreaCategory,
} from "@/lib/shop/areaCategories";
import type { Tables } from "@/types/database";

export interface VendorCatalogEntry {
  product_id: string;
  code: string;
  name: string | null;
  dosage_vial: string | null;
  price_usd: number;
  bulk_price_usd: number | null;
  bulk_price_min_quantity: number | null;
  vendor_raw: Record<string, unknown>;
  imported_category_key: string | null;
}

export type VendorUnmatchedReason = "not_in_master" | "no_price";

export interface VendorCatalogUnmatched {
  code: string;
  reason: VendorUnmatchedReason;
  rawText: string;
}

export interface VendorCatalogMatchResult {
  matched: VendorCatalogEntry[];
  unmatched: VendorCatalogUnmatched[];
  /** Convenience: unique unmatched codes (not_in_master). */
  unmatchedCodes: string[];
}

export function normalizeVendorSku(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function buildVendorRaw(row: ParsedProductImportRow): Record<string, unknown> {
  return {
    rowNumber: row.rowNumber,
    rawText: row.rawText,
    code: row.parsedCode,
    name: row.parsedName,
    dosageVial: row.parsedDosageVial,
    description: row.parsedDescription,
    category: row.parsedCategory,
    priceUsd: row.parsedPriceUsd,
    bulkPriceUsd: row.parsedBulkPriceUsd,
    bulkPriceMinQuantity: row.parsedBulkPriceMinQuantity,
    extraFields: row.extraFields,
  };
}

/**
 * Matches parsed dealer-file rows against the global product master by SKU.
 * Global products that are not in the file never appear in `matched`.
 */
export function matchVendorCatalogRows(
  rows: ParsedProductImportRow[],
  globalProducts: Tables<"products">[],
  areaCategories: readonly Pick<AreaCategory, "category_key" | "label">[] = [],
): VendorCatalogMatchResult {
  const productsByCode = new Map<string, Tables<"products">>();
  for (const product of globalProducts) {
    productsByCode.set(normalizeVendorSku(product.code), product);
  }

  const matched: VendorCatalogEntry[] = [];
  const unmatched: VendorCatalogUnmatched[] = [];
  const seenProductIds = new Set<string>();
  const seenUnmatched = new Set<string>();

  for (const row of rows) {
    const rawCode = row.parsedCode?.trim();
    if (!rawCode) continue;

    const code = normalizeVendorSku(rawCode);
    const product = productsByCode.get(code);

    if (!product) {
      if (!seenUnmatched.has(code)) {
        seenUnmatched.add(code);
        unmatched.push({ code, reason: "not_in_master", rawText: row.rawText });
      }
      continue;
    }

    if (row.parsedPriceUsd == null || row.parsedPriceUsd <= 0) {
      if (!seenUnmatched.has(code)) {
        seenUnmatched.add(code);
        unmatched.push({ code, reason: "no_price", rawText: row.rawText });
      }
      continue;
    }

    if (seenProductIds.has(product.id)) continue;
    seenProductIds.add(product.id);

    matched.push({
      product_id: product.id,
      code: product.code,
      name: row.parsedName ?? product.name,
      dosage_vial: row.parsedDosageVial ?? product.dosage_vial,
      price_usd: row.parsedPriceUsd,
      bulk_price_usd: row.parsedBulkPriceUsd ?? null,
      bulk_price_min_quantity: row.parsedBulkPriceMinQuantity ?? null,
      vendor_raw: buildVendorRaw(row),
      imported_category_key: parseImportedCategoryKey(row.parsedCategory, areaCategories),
    });
  }

  return {
    matched,
    unmatched,
    unmatchedCodes: unmatched.filter((row) => row.reason === "not_in_master").map((row) => row.code),
  };
}

export interface CatalogSnapshot {
  entries: Array<{ product_id: string; price_usd: number }>;
}

export function diffVendorCatalog(
  current: CatalogSnapshot,
  next: VendorCatalogMatchResult,
): { added: string[]; removed: string[] } {
  const currentIds = new Set(current.entries.map((entry) => entry.product_id));
  const nextIds = new Set(next.matched.map((entry) => entry.product_id));

  return {
    added: next.matched.filter((entry) => !currentIds.has(entry.product_id)).map((entry) => entry.code),
    removed: current.entries.filter((entry) => !nextIds.has(entry.product_id)).map((entry) => entry.product_id),
  };
}

export interface VendorManualOverride {
  product_id: string;
  imported_price_usd: number | null;
  manual_price_usd: number | null;
}

export interface VendorOverrideConflict {
  product_id: string;
  code: string;
  newImportedUsd: number;
  currentImportedUsd: number | null;
  currentManualUsd: number;
}

/** SKUs that stay in the catalog and currently have a manual grundpreis. */
export function vendorOverrideConflicts(
  matched: VendorCatalogEntry[],
  currentPrices: VendorManualOverride[],
): VendorOverrideConflict[] {
  const byId = new Map(currentPrices.map((row) => [row.product_id, row]));
  return matched.flatMap((entry) => {
    const current = byId.get(entry.product_id);
    if (current?.manual_price_usd == null || current.manual_price_usd <= 0) return [];
    return [
      {
        product_id: entry.product_id,
        code: entry.code,
        newImportedUsd: entry.price_usd,
        currentImportedUsd: current.imported_price_usd,
        currentManualUsd: current.manual_price_usd,
      },
    ];
  });
}

export const VENDOR_PDF_UNREADABLE =
  "Die Produktdaten konnten aus dieser PDF nicht eindeutig erkannt werden. Bitte CSV oder Excel verwenden.";

export const VENDOR_UPLOAD_FAILED =
  "Händlerdatei konnte nicht gespeichert werden. Der bisherige Katalog bleibt unverändert.";

export const VENDOR_APPLY_FAILED =
  "Der Händlerkatalog konnte nicht angewendet werden. Der bisherige Katalog bleibt unverändert.";

export interface VendorCatalogDocumentRef {
  storage_path: string;
  file_name: string;
}

/**
 * Storage and Postgres are separate systems. Upload the new file first, then
 * replace the catalog (and the applied-document pointer) in one DB call.
 * Only after that may the previous storage object be removed.
 */
export async function runVendorCatalogApply<TApplied>(input: {
  previousStoragePath: string | null;
  uploadNewFile: () => Promise<VendorCatalogDocumentRef>;
  applyCatalog: (document: VendorCatalogDocumentRef) => Promise<TApplied>;
  removePreviousFile: (storagePath: string) => Promise<void>;
}): Promise<{ applied: TApplied; document: VendorCatalogDocumentRef }> {
  let document: VendorCatalogDocumentRef;
  try {
    document = await input.uploadNewFile();
  } catch (error) {
    throw new Error(withCause(VENDOR_UPLOAD_FAILED, error), { cause: error });
  }

  let applied: TApplied;
  try {
    applied = await input.applyCatalog(document);
  } catch (error) {
    throw new Error(withCause(VENDOR_APPLY_FAILED, error), { cause: error });
  }

  if (input.previousStoragePath && input.previousStoragePath !== document.storage_path) {
    try {
      await input.removePreviousFile(input.previousStoragePath);
    } catch {
      // Leftover previous file is harmless; the applied pointer already moved.
    }
  }

  return { applied, document };
}

function withCause(message: string, error: unknown): string {
  return error instanceof Error && error.message && error.message !== message
    ? `${message} ${error.message}`
    : message;
}

/**
 * Vendor catalog matching logic.
 *
 * Each shop area is an independent vendor. The uploaded dealer file is the
 * only assortment source. Global `products` is an optional SKU link, never a
 * gate: a valid dealer row is imported even when its SKU is absent from the
 * master. Matching is exact after trim+uppercase — never by name or dosage.
 *
 * No database calls. Used by AdminShopAreas and unit tests.
 */

import { matchImportField, type ParsedProductImportRow } from "@/lib/productImportRow";
import {
  parseImportedCategoryKey,
  type AreaCategory,
} from "@/lib/shop/areaCategories";
import type { Tables } from "@/types/database";

export interface VendorCatalogEntry {
  product_id: string | null;
  code: string;
  name: string | null;
  dosage_vial: string | null;
  price_usd: number;
  bulk_price_usd: number | null;
  bulk_price_min_quantity: number | null;
  vendor_raw: Record<string, unknown>;
  imported_category_key: string | null;
}

export type VendorUnmatchedReason = "no_price";

export interface VendorCatalogUnmatched {
  code: string;
  reason: VendorUnmatchedReason;
  rawText: string;
}

export interface VendorCatalogMatchResult {
  /** Every valid dealer row (code + price). Includes rows without a master product. */
  matched: VendorCatalogEntry[];
  /** Rows that cannot be imported (currently: missing/invalid price). */
  unmatched: VendorCatalogUnmatched[];
  /** Dealer SKUs imported without a global products row. Informational, not an error. */
  unlinkedCodes: string[];
  /** @deprecated Use unlinkedCodes. Kept as an alias so older tests can migrate. */
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
    dosageVial: vendorDosageFromRow(row),
    description: row.parsedDescription,
    category: row.parsedCategory,
    priceUsd: row.parsedPriceUsd,
    bulkPriceUsd: row.parsedBulkPriceUsd,
    bulkPriceMinQuantity: row.parsedBulkPriceMinQuantity,
    extraFields: row.extraFields,
  };
}

/**
 * Carries a product name forward when later variant rows leave the name cell empty.
 * Does not invent names for leading rows that never had one.
 */
export function forwardFillVendorNames(rows: ParsedProductImportRow[]): ParsedProductImportRow[] {
  let lastName: string | null = null;
  return rows.map((row) => {
    const name = row.parsedName?.trim() || null;
    if (name) {
      lastName = name;
      return row;
    }
    if (!lastName || !row.parsedCode) return row;
    return { ...row, parsedName: lastName };
  });
}

/** Dealer-file variant/dosage. Never invents a value from the global master. */
export function vendorDosageFromRow(row: ParsedProductImportRow): string | null {
  const direct = row.parsedDosageVial?.trim() || null;
  if (direct) return direct;
  if (!row.extraFields) return null;
  for (const [key, value] of Object.entries(row.extraFields)) {
    if (matchImportField(key) === "dosageVial") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

/**
 * Maps parsed dealer-file rows onto optional global products by SKU.
 * Rows without a master match stay in `matched` with `product_id: null`.
 */
export function matchVendorCatalogRows(
  rows: ParsedProductImportRow[],
  globalProducts: Tables<"products">[],
  areaCategories: readonly Pick<AreaCategory, "category_key" | "label">[] = [],
): VendorCatalogMatchResult {
  const filled = forwardFillVendorNames(rows);
  const productsByCode = new Map<string, Tables<"products">>();
  for (const product of globalProducts) {
    productsByCode.set(normalizeVendorSku(product.code), product);
  }

  const matched: VendorCatalogEntry[] = [];
  const unmatched: VendorCatalogUnmatched[] = [];
  const seenCodes = new Set<string>();
  const seenUnmatched = new Set<string>();
  const unlinkedCodes: string[] = [];

  for (const row of filled) {
    const rawCode = row.parsedCode?.trim();
    if (!rawCode) continue;

    const code = normalizeVendorSku(rawCode);
    const product = productsByCode.get(code) ?? null;

    if (row.parsedPriceUsd == null || row.parsedPriceUsd <= 0) {
      if (!seenUnmatched.has(code)) {
        seenUnmatched.add(code);
        unmatched.push({ code, reason: "no_price", rawText: row.rawText });
      }
      continue;
    }

    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    if (!product) unlinkedCodes.push(code);

    matched.push({
      product_id: product?.id ?? null,
      code,
      name: row.parsedName ?? product?.name ?? null,
      dosage_vial: vendorDosageFromRow(row),
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
    unlinkedCodes,
    unmatchedCodes: unlinkedCodes,
  };
}

export interface CatalogSnapshot {
  entries: Array<{ product_id: string | null; vendor_code?: string; price_usd: number }>;
}

export function diffVendorCatalog(
  current: CatalogSnapshot,
  next: VendorCatalogMatchResult,
): { added: string[]; removed: string[] } {
  const currentCodes = new Set(
    current.entries.map((entry) => normalizeVendorSku(entry.vendor_code ?? entry.product_id ?? "")).filter(Boolean),
  );
  const nextCodes = new Set(next.matched.map((entry) => entry.code));

  return {
    added: next.matched.filter((entry) => !currentCodes.has(entry.code)).map((entry) => entry.code),
    removed: current.entries
      .map((entry) => normalizeVendorSku(entry.vendor_code ?? ""))
      .filter((code) => code && !nextCodes.has(code)),
  };
}

export interface VendorManualOverride {
  product_id: string | null;
  vendor_code?: string;
  imported_price_usd: number | null;
  manual_price_usd: number | null;
}

export interface VendorOverrideConflict {
  product_id: string | null;
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
  const byCode = new Map<string, VendorManualOverride>();
  for (const row of currentPrices) {
    const code = row.vendor_code ? normalizeVendorSku(row.vendor_code) : "";
    if (code) byCode.set(code, row);
  }
  const byId = new Map(
    currentPrices.filter((row) => row.product_id).map((row) => [row.product_id as string, row]),
  );
  return matched.flatMap((entry) => {
    const current = byCode.get(entry.code) ?? (entry.product_id ? byId.get(entry.product_id) : undefined);
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

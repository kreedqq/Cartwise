/**
 * Vendor catalog matching logic.
 *
 * Each shop area is an independent vendor with its own catalog defined by an
 * imported document. This module contains the pure matching logic that maps
 * parsed import rows onto the global product catalog by normalized SKU code.
 *
 * No database calls – all functions here are pure TypeScript.
 *
 * Architecture rule: called by both AdminShopAreas UI and vendorCatalog tests.
 * Never import from services/ or hooks/ here.
 */

import type { ParsedProductImportRow } from "@/lib/productImportRow";
import type { Tables } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One product that matched a vendor document row and will enter the catalog. */
export interface VendorCatalogEntry {
  /** ID in the global products table. */
  product_id: string;
  /** Normalized article code / SKU. */
  code: string;
  /** Vendor import price – used as the area-specific base price. */
  price_usd: number;
  bulk_price_usd: number | null;
  bulk_price_min_quantity: number | null;
}

/** Summary returned by matchVendorCatalogRows. */
export interface VendorCatalogMatchResult {
  /** Products found in both the document and the global catalog. */
  matched: VendorCatalogEntry[];
  /** Normalized codes from the document that have NO matching global product. */
  unmatchedCodes: string[];
}

// ---------------------------------------------------------------------------
// Core matching function
// ---------------------------------------------------------------------------

/**
 * Matches parsed import rows against the global product list by SKU code.
 *
 * Rules:
 * - Matching is case-insensitive on normalized (upper-trimmed) code.
 * - Only rows with a non-null, non-empty parsedCode and a positive parsedPriceUsd
 *   are considered.
 * - Each global product appears at most once (first match wins if a code appears
 *   more than once in the file).
 * - Codes not found in the global catalog are collected in `unmatchedCodes`.
 *
 * This is intentionally a pure function so it can be used in unit tests
 * without any database dependency.
 */
export function matchVendorCatalogRows(
  rows: ParsedProductImportRow[],
  globalProducts: Tables<"products">[],
): VendorCatalogMatchResult {
  // Build lookup: normalized code → product row
  const productsByCode = new Map<string, Tables<"products">>();
  for (const p of globalProducts) {
    productsByCode.set(p.code.trim().toUpperCase(), p);
  }

  const matched: VendorCatalogEntry[] = [];
  const unmatchedCodes: string[] = [];
  const seenProductIds = new Set<string>();

  for (const row of rows) {
    const rawCode = row.parsedCode?.trim();
    if (!rawCode) continue;

    const code = rawCode.toUpperCase();

    // Only rows with a positive price qualify as catalog entries.
    if (row.parsedPriceUsd == null || row.parsedPriceUsd <= 0) continue;

    const product = productsByCode.get(code);
    if (!product) {
      // Track unmatched only once per code
      if (!unmatchedCodes.includes(code)) {
        unmatchedCodes.push(code);
      }
      continue;
    }

    // Deduplicate: keep the first occurrence if the same product appears twice.
    if (seenProductIds.has(product.id)) continue;
    seenProductIds.add(product.id);

    matched.push({
      product_id: product.id,
      code: product.code,
      price_usd: row.parsedPriceUsd,
      bulk_price_usd: row.parsedBulkPriceUsd ?? null,
      bulk_price_min_quantity: row.parsedBulkPriceMinQuantity ?? null,
    });
  }

  return { matched, unmatchedCodes };
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

/** Current catalog state as a lightweight map (product_id → price). */
export interface CatalogSnapshot {
  entries: Array<{ product_id: string; price_usd: number }>;
}

/**
 * Compares a new match result against the current catalog snapshot and returns
 * which entries will be added and which will be removed.
 */
export function diffVendorCatalog(
  current: CatalogSnapshot,
  next: VendorCatalogMatchResult,
): { added: string[]; removed: string[] } {
  const currentIds = new Set(current.entries.map((e) => e.product_id));
  const nextIds = new Set(next.matched.map((e) => e.product_id));

  return {
    added: next.matched.filter((e) => !currentIds.has(e.product_id)).map((e) => e.code),
    removed: current.entries
      .filter((e) => !nextIds.has(e.product_id))
      .map((e) => e.product_id),
  };
}

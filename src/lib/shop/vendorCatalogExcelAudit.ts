/**
 * Read-only diff: Excel / vendor import rows vs live shop_area catalog.
 * Pure logic — no Supabase.
 */

import { effectiveAreaPriceUsd } from "@/lib/shop/shopAreaPricing";
import { normalizeVendorSku, type VendorCatalogEntry } from "@/lib/shop/vendorCatalog";
import type { Tables } from "@/types/database";

export type VendorCatalogAuditStatus =
  | "MATCH"
  | "PRICE_MISMATCH"
  | "VARIANT_MISMATCH"
  | "PRODUCT_MISMATCH"
  | "MISSING_IN_SHOP"
  | "DUPLICATE_IN_SHOP"
  | "EXTRA_IN_SHOP"
  | "UNRESOLVED_MASTER_PRODUCT";

export interface VendorCatalogAuditLine {
  code: string;
  status: VendorCatalogAuditStatus;
  excelProduct: string | null;
  excelVariant: string | null;
  excelPriceUsd: number | null;
  shopProduct: string | null;
  shopVariant: string | null;
  shopPriceUsd: number | null;
  shopAreaKey: string | null;
  shopActive: boolean | null;
  shopCategoryKey: string | null;
  masterProductId: string | null;
  notes: string[];
}

export interface VendorCatalogAuditSummary {
  totalExcel: number;
  totalShop: number;
  matched: number;
  priceMismatches: number;
  variantMismatches: number;
  productMismatches: number;
  missingInShop: number;
  duplicatesInShop: number;
  extraInShop: number;
  /** Local QA seed rows excluded from business `extraInShop` (not in Emma Excel). */
  qaFixtureExtras: number;
  vendorOnly: number;
  unresolvedMaster: number;
  lines: VendorCatalogAuditLine[];
}

/** Local-only QA catalog codes from `supabase/qa/seed_qa_catalog.sql` — never on production. */
export const LOCAL_QA_SEED_VENDOR_CODES = new Set([
  "QA-KIT-001",
  "QA-OIL-001",
  "QA-ORAL-001",
  "QA-PEP-001",
  "QA-VENDOR-ONLY",
  "QA-WATER-001",
]);

export interface VendorCatalogAuditOptions {
  /** Shop-only codes ignored for business extra count (e.g. local QA fixtures). */
  ignoreExtraVendorCodes?: ReadonlySet<string>;
}

export interface ShopCatalogAuditRow {
  shopAreaKey: string;
  vendorCode: string;
  vendorName: string | null;
  vendorDosage: string | null;
  isActive: boolean;
  productId: string | null;
  importedCategoryKey: string | null;
  manualCategoryKey: string | null;
  importedPriceUsd: number | null;
  manualPriceUsd: number | null;
  bulkPriceUsd: number | null;
  bulkMinQuantity: number | null;
}

function normText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normVariant(value: string | null | undefined): string {
  return normText(value).replace(/\s+/g, "").toLowerCase();
}

function pricesEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.005;
}

function shopRowsFromAdmin(
  areaKey: string,
  catalog: Tables<"shop_area_products">[],
  prices: Tables<"shop_area_product_prices">[],
): ShopCatalogAuditRow[] {
  const priceByCode = new Map(
    prices.filter((row) => row.vendor_code).map((row) => [normalizeVendorSku(row.vendor_code), row] as const),
  );
  return catalog.map((row) => {
    const code = normalizeVendorSku(row.vendor_code);
    const price = priceByCode.get(code);
    return {
      shopAreaKey: areaKey,
      vendorCode: code,
      vendorName: row.vendor_name,
      vendorDosage: row.vendor_dosage,
      isActive: row.is_active,
      productId: row.product_id,
      importedCategoryKey: row.imported_category_key,
      manualCategoryKey: row.manual_category_key,
      importedPriceUsd: price?.imported_price_usd ?? price?.price_usd ?? null,
      manualPriceUsd: price?.manual_price_usd ?? null,
      bulkPriceUsd: price?.bulk_price_usd ?? null,
      bulkMinQuantity: price?.bulk_price_min_quantity ?? null,
    };
  });
}

function effectiveShopUsd(row: ShopCatalogAuditRow): number | null {
  return effectiveAreaPriceUsd(row.importedPriceUsd, row.manualPriceUsd);
}

/** Compare matched Excel import rows to the current area catalog. */
export function auditVendorCatalogAgainstShop(
  areaKey: string,
  excelRows: VendorCatalogEntry[],
  catalog: Tables<"shop_area_products">[],
  prices: Tables<"shop_area_product_prices">[],
  productsById: Map<string, Tables<"products">>,
  options?: VendorCatalogAuditOptions,
): VendorCatalogAuditSummary {
  const shopRows = shopRowsFromAdmin(areaKey, catalog, prices);
  const shopByCode = new Map<string, ShopCatalogAuditRow[]>();
  for (const row of shopRows) {
    const list = shopByCode.get(row.vendorCode) ?? [];
    list.push(row);
    shopByCode.set(row.vendorCode, list);
  }

  const lines: VendorCatalogAuditLine[] = [];
  let matched = 0;
  let priceMismatches = 0;
  let variantMismatches = 0;
  let productMismatches = 0;
  let missingInShop = 0;
  let vendorOnly = 0;
  let unresolvedMaster = 0;

  const excelCodes = new Set<string>();

  for (const excel of excelRows) {
    const code = normalizeVendorSku(excel.code);
    excelCodes.add(code);
    const shopMatches = shopByCode.get(code) ?? [];

    if (shopMatches.length === 0) {
      missingInShop += 1;
      if (excel.product_id == null) vendorOnly += 1;
      lines.push({
        code,
        status: "MISSING_IN_SHOP",
        excelProduct: excel.name,
        excelVariant: excel.dosage_vial,
        excelPriceUsd: excel.price_usd,
        shopProduct: null,
        shopVariant: null,
        shopPriceUsd: null,
        shopAreaKey: areaKey,
        shopActive: null,
        shopCategoryKey: null,
        masterProductId: excel.product_id,
        notes: excel.product_id == null ? ["vendor_only_excel"] : [],
      });
      continue;
    }

    if (shopMatches.length > 1) {
      lines.push({
        code,
        status: "DUPLICATE_IN_SHOP",
        excelProduct: excel.name,
        excelVariant: excel.dosage_vial,
        excelPriceUsd: excel.price_usd,
        shopProduct: shopMatches[0]?.vendorName ?? null,
        shopVariant: shopMatches[0]?.vendorDosage ?? null,
        shopPriceUsd: effectiveShopUsd(shopMatches[0]!),
        shopAreaKey: areaKey,
        shopActive: shopMatches[0]?.isActive ?? null,
        shopCategoryKey: shopMatches[0]?.importedCategoryKey,
        masterProductId: shopMatches[0]?.productId ?? null,
        notes: [`shop_rows:${shopMatches.length}`],
      });
      continue;
    }

    const shop = shopMatches[0]!;
    const notes: string[] = [];
    if (shop.bulkPriceUsd != null || shop.bulkMinQuantity != null) {
      notes.push("shop_has_bulk_fields");
    }
    if (excel.product_id == null) vendorOnly += 1;
    if (excel.product_id && shop.productId && excel.product_id !== shop.productId) {
      unresolvedMaster += 1;
      notes.push("master_product_id_mismatch");
    }
    if (excel.product_id && !shop.productId) {
      unresolvedMaster += 1;
      notes.push("shop_missing_master_link");
    }

    const productMismatch =
      normText(excel.name).toLowerCase() !== normText(shop.vendorName).toLowerCase();
    const variantMismatch = normVariant(excel.dosage_vial) !== normVariant(shop.vendorDosage);
    const shopUsd = effectiveShopUsd(shop);
    const priceMismatch = !pricesEqual(excel.price_usd, shopUsd);

    let status: VendorCatalogAuditStatus = "MATCH";
    if (productMismatch) {
      status = "PRODUCT_MISMATCH";
      productMismatches += 1;
    } else if (variantMismatch) {
      status = "VARIANT_MISMATCH";
      variantMismatches += 1;
    } else if (priceMismatch) {
      status = "PRICE_MISMATCH";
      priceMismatches += 1;
    } else {
      matched += 1;
    }

    if (notes.includes("master_product_id_mismatch") && status === "MATCH") {
      status = "UNRESOLVED_MASTER_PRODUCT";
      unresolvedMaster += 1;
    }

    lines.push({
      code,
      status,
      excelProduct: excel.name,
      excelVariant: excel.dosage_vial,
      excelPriceUsd: excel.price_usd,
      shopProduct: shop.vendorName,
      shopVariant: shop.vendorDosage,
      shopPriceUsd: shopUsd,
      shopAreaKey: areaKey,
      shopActive: shop.isActive,
      shopCategoryKey: shop.importedCategoryKey,
      masterProductId: shop.productId,
      notes,
    });
  }

  let extraInShop = 0;
  let qaFixtureExtras = 0;
  const ignoreExtra = options?.ignoreExtraVendorCodes;
  for (const row of shopRows) {
    if (excelCodes.has(row.vendorCode)) continue;
    if (ignoreExtra?.has(row.vendorCode)) {
      qaFixtureExtras += 1;
      continue;
    }
    extraInShop += 1;
    lines.push({
      code: row.vendorCode,
      status: "EXTRA_IN_SHOP",
      excelProduct: null,
      excelVariant: null,
      excelPriceUsd: null,
      shopProduct: row.vendorName,
      shopVariant: row.vendorDosage,
      shopPriceUsd: effectiveShopUsd(row),
      shopAreaKey: areaKey,
      shopActive: row.isActive,
      shopCategoryKey: row.importedCategoryKey,
      masterProductId: row.productId,
      notes: [],
    });
  }

  lines.sort((a, b) => a.code.localeCompare(b.code));

  return {
    totalExcel: excelRows.length,
    totalShop: shopRows.length,
    matched,
    priceMismatches,
    variantMismatches,
    productMismatches,
    missingInShop,
    duplicatesInShop: lines.filter((line) => line.status === "DUPLICATE_IN_SHOP").length,
    extraInShop,
    qaFixtureExtras,
    vendorOnly,
    unresolvedMaster,
    lines,
  };
}

export function summarizeVendorCatalogAudit(summary: VendorCatalogAuditSummary): string {
  const parts = [
    `Excel: ${summary.totalExcel}`,
    `Shop: ${summary.totalShop}`,
    `Treffer: ${summary.matched}`,
    `Preis: ${summary.priceMismatches}`,
    `Variante: ${summary.variantMismatches}`,
    `Produkt: ${summary.productMismatches}`,
    `Fehlend: ${summary.missingInShop}`,
    `Doppelt: ${summary.duplicatesInShop}`,
    `Extra: ${summary.extraInShop}`,
  ];
  if (summary.qaFixtureExtras > 0) {
    parts.push(`QA-Fixture: ${summary.qaFixtureExtras}`);
  }
  parts.push(`Vendor-only: ${summary.vendorOnly}`);
  return parts.join(" · ");
}

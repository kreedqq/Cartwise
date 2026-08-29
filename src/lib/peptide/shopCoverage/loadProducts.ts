import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import type { ShopCatalogProduct } from "@/lib/peptide/shopCoverage/types";

const DEFAULT_DUMP = "../PEPTIX-BACKUPS/PEPTIX-PRODUCTION-0031-FINAL-2026-08-29-1213-public-data.sql";

function nullCopy(value: string): string | null {
  return value === "\\N" ? null : value;
}

export function parseProductsFromDump(sqlText: string): Map<string, Omit<ShopCatalogProduct, "code" | "name">> {
  const marker = 'COPY "public"."products"';
  const start = sqlText.indexOf(marker);
  if (start < 0) return new Map();

  const bodyStart = sqlText.indexOf("\n", start) + 1;
  const bodyEnd = sqlText.indexOf("\n\\.\n", bodyStart);
  if (bodyEnd < 0) return new Map();

  const byCode = new Map<string, Omit<ShopCatalogProduct, "code" | "name">>();
  for (const line of sqlText.slice(bodyStart, bodyEnd).split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 12) continue;
    const code = parts[1]?.trim().toUpperCase();
    if (!code) continue;
    byCode.set(code, {
      category: nullCopy(parts[4] ?? ""),
      variantLabel: nullCopy(parts[11] ?? ""),
      isActive: parts[7] === "t",
    });
  }
  return byCode;
}

function loadDumpRows(dumpPath?: string): Map<string, Omit<ShopCatalogProduct, "code" | "name">> {
  if (typeof window !== "undefined") return new Map();

  try {
    // Node-only enrichment from optional SQL dump; browser uses LIVE_SHOP_PRODUCTS only.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolve } = require("node:path") as typeof import("node:path");
    const path = dumpPath ?? process.env.LEXICON_COVERAGE_DUMP ?? resolve(process.cwd(), DEFAULT_DUMP);
    if (!existsSync(path)) return new Map();
    return parseProductsFromDump(readFileSync(path, "utf8"));
  } catch {
    return new Map();
  }
}

export function loadShopCatalogProducts(dumpPath?: string): ShopCatalogProduct[] {
  const dumpRows = loadDumpRows(dumpPath);

  return LIVE_SHOP_PRODUCTS.map((product) => {
    const extra = dumpRows.get(product.code.trim().toUpperCase());
    return {
      code: product.code,
      name: product.name,
      category: extra?.category ?? null,
      variantLabel: extra?.variantLabel ?? null,
      isActive: extra?.isActive ?? true,
    };
  });
}

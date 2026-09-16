import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

import {
  auditVendorCatalogAgainstShop,
  LOCAL_QA_SEED_VENDOR_CODES,
} from "@/lib/shop/vendorCatalogExcelAudit";
import { effectiveAreaPriceUsd } from "@/lib/shop/shopAreaPricing";
import { matchVendorCatalogRows } from "@/lib/shop/vendorCatalog";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";
import { assertSafeLocalQaTarget } from "@/lib/qa/productionGuard";
import type { Tables } from "@/types/database";

const EMMA_XLSX = resolve(
  process.cwd(),
  "src/tests/fixtures/Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx",
);

const SPOT = ["BA3", "BA10", "AA3", "AA10", "WA10", "KP10", "AD5", "AD10"] as const;

async function loadExcelMatched() {
  const buffer = readFileSync(EMMA_XLSX);
  const file = new File([buffer], "Emma.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const parsed = await parseVendorCatalogFile(file);
  const { matched } = matchVendorCatalogRows(parsed.rows, []);
  expect(matched).toHaveLength(136);
  return matched;
}

function assertBusinessExcelMatch(summary: ReturnType<typeof auditVendorCatalogAgainstShop>) {
  const bad = summary.lines.filter(
    (l) => l.status !== "MATCH" && l.status !== "EXTRA_IN_SHOP",
  );
  if (bad.length) {
    console.error(JSON.stringify(bad.slice(0, 30), null, 2));
  }
  expect(summary.matched).toBe(136);
  expect(summary.priceMismatches).toBe(0);
  expect(summary.variantMismatches).toBe(0);
  expect(summary.productMismatches).toBe(0);
  expect(summary.missingInShop).toBe(0);
  expect(summary.duplicatesInShop).toBe(0);
  expect(summary.extraInShop).toBe(0);
  expect(bad).toHaveLength(0);
  console.log(JSON.stringify({ qaFixtureExtras: summary.qaFixtureExtras }));
}

describe.skipIf(process.env.PEPTIX_GB1_LOCAL !== "1")("Arc B local full Excel audit", () => {
  it("136/136 MATCH after apply readback", async () => {
    const url = process.env.VITE_SUPABASE_URL ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    assertSafeLocalQaTarget({ supabaseUrl: url });
    const client = createClient(url, service, { auth: { persistSession: false } });
    const matched = await loadExcelMatched();
    const [{ data: catalog }, { data: prices }, { data: products }] = await Promise.all([
      client.from("shop_area_products").select("*").eq("shop_area_key", "group_buy_1"),
      client.from("shop_area_product_prices").select("*").eq("shop_area_key", "group_buy_1"),
      client.from("products").select("*"),
    ]);
    const productById = new Map((products ?? []).map((p) => [p.id, p as Tables<"products">]));
    const summary = auditVendorCatalogAgainstShop(
      "group_buy_1",
      matched,
      (catalog ?? []) as Tables<"shop_area_products">[],
      (prices ?? []) as Tables<"shop_area_product_prices">[],
      productById,
      { ignoreExtraVendorCodes: LOCAL_QA_SEED_VENDOR_CODES },
    );
    assertBusinessExcelMatch(summary);
    for (const code of SPOT) {
      const excel = matched.find((m) => m.code.toUpperCase() === code);
      const line = summary.lines.find((l) => l.code === code);
      expect(line?.status).toBe("MATCH");
      expect(line?.excelPriceUsd).toBe(excel?.price_usd);
    }
  });
});

describe.skipIf(process.env.PEPTIX_PROD_AUDIT !== "1")("Arc B production snapshot Excel audit (read-only data file)", () => {
  it("reports full 136 row diff from exported prod payload", async () => {
    const path = process.env.PEPTIX_PROD_GB1_JSON;
    if (!path) throw new Error("PEPTIX_PROD_GB1_JSON required");
    const payload = JSON.parse(readFileSync(path, "utf8")) as {
      catalog: Tables<"shop_area_products">[];
      prices: Tables<"shop_area_product_prices">[];
      products: Tables<"products">[];
    };
    const matched = await loadExcelMatched();
    const productById = new Map(payload.products.map((p) => [p.id, p]));
    const summary = auditVendorCatalogAgainstShop(
      "group_buy_1",
      matched,
      payload.catalog,
      payload.prices,
      productById,
    );
    const priceSources: Record<string, unknown> = {};
    for (const code of SPOT) {
      const pr = payload.prices.find((x) => x.vendor_code.toUpperCase() === code);
      const excel = matched.find((m) => m.code.toUpperCase() === code);
      const prod = pr?.product_id ? productById.get(pr.product_id) : null;
      priceSources[code] = {
        excelPrice: excel?.price_usd ?? null,
        imported_price_usd: pr?.imported_price_usd ?? null,
        manual_price_usd: pr?.manual_price_usd ?? null,
        price_usd: pr?.price_usd ?? null,
        globalCatalogUsd: prod?.price_usd ?? null,
        effectiveAreaUsd: effectiveAreaPriceUsd(
          pr?.imported_price_usd ?? pr?.price_usd ?? null,
          pr?.manual_price_usd ?? null,
        ),
      };
    }
    console.log(
      JSON.stringify(
        {
          matched: summary.matched,
          priceMismatches: summary.priceMismatches,
          variantMismatches: summary.variantMismatches,
          missingInShop: summary.missingInShop,
          duplicatesInShop: summary.duplicatesInShop,
          extraInShop: summary.extraInShop,
          catalogRows: payload.catalog.length,
          mismatches: summary.lines.filter((l) => l.status !== "MATCH"),
          priceSources,
        },
        null,
        2,
      ),
    );
    assertBusinessExcelMatch(summary);
  });
});

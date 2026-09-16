import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { auditVendorCatalogAgainstShop, summarizeVendorCatalogAudit } from "@/lib/shop/vendorCatalogExcelAudit";
import { matchVendorCatalogRows } from "@/lib/shop/vendorCatalog";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";

const EMMA_XLSX = resolve(
  process.cwd(),
  "src/tests/fixtures/Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx",
);

describe("vendorCatalogExcelAudit", () => {
  it("flags all Excel rows missing when shop catalog is empty", async () => {
    const buffer = readFileSync(EMMA_XLSX);
    const file = new File([buffer], "Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseVendorCatalogFile(file);
    const { matched } = matchVendorCatalogRows(parsed.rows, []);
    expect(matched).toHaveLength(136);

    const summary = auditVendorCatalogAgainstShop("group_buy_1", matched, [], [], new Map());
    expect(summary.totalExcel).toBe(136);
    expect(summary.totalShop).toBe(0);
    expect(summary.matched).toBe(0);
    expect(summary.missingInShop).toBe(136);
    expect(summary.lines.filter((line) => line.code === "BA3")[0]).toMatchObject({
      status: "MISSING_IN_SHOP",
      excelVariant: "3ml*10vials",
      excelPriceUsd: 5,
    });
    expect(summarizeVendorCatalogAudit(summary)).toContain("Fehlend: 136");
  });

  it("detects price and variant mismatches", () => {
    const excel = [
      {
        product_id: null,
        code: "BA3",
        name: "BAC Water",
        dosage_vial: "3ml*10vials",
        price_usd: 5,
        bulk_price_usd: null,
        bulk_price_min_quantity: null,
        vendor_raw: {},
        imported_category_key: null,
      },
    ];
    const catalog = [
      {
        shop_area_key: "group_buy_1",
        product_id: null,
        id: "sap-ba3",
        vendor_code: "BA3",
        is_active: true,
        updated_at: "2026-01-01T00:00:00Z",
        vendor_name: "BAC Water",
        vendor_dosage: "10ml*10vials",
        vendor_raw: null,
        imported_category_key: null,
        manual_category_key: null,
      },
    ];
    const prices = [
      {
        shop_area_key: "group_buy_1",
        product_id: null,
        vendor_code: "BA3",
        price_usd: 7,
        imported_price_usd: 7,
        manual_price_usd: null,
        bulk_price_usd: null,
        bulk_price_min_quantity: null,
        updated_at: "2026-01-01T00:00:00Z",
        updated_by: null,
      },
    ];
    const summary = auditVendorCatalogAgainstShop("group_buy_1", excel, catalog, prices, new Map());
    expect(summary.variantMismatches).toBe(1);
    expect(summary.priceMismatches).toBe(0);
    expect(summary.lines[0]?.status).toBe("VARIANT_MISMATCH");
  });
});

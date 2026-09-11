import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  forwardFillVendorNames,
  matchVendorCatalogRows,
  normalizeVendorSku,
} from "@/lib/shop/vendorCatalog";
import type { ParsedProductImportRow } from "@/lib/productImportRow";
import type { Tables } from "@/types/database";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";

const EMMA_XLSX = resolve(
  process.cwd(),
  "src/tests/fixtures/Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx",
);

const REQUIRED_UNLINKED_SKUS = [
  "SM40",
  "SM50",
  "TR80",
  "EL5",
  "EL10",
  "AU50",
  "AD10",
  "MS20",
  "20AM",
  "KP30",
  "KP50",
  "VP5",
  "G500",
  "LC216",
  "LC120",
  "LC600",
  "柠檬瓶",
  "BA3",
  "AA3",
  "WA10",
];

function makeProduct(code: string): Tables<"products"> {
  return {
    id: `id-${code.toLowerCase()}`,
    code,
    name: `Product ${code}`,
    description: null,
    dosage_vial: null,
    category: null,
    price_usd: 100,
    bulk_price_usd: null,
    bulk_price_min_quantity: null,
    currency: "USD",
    is_active: true,
    last_price_change_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeImportRow(
  code: string,
  price: number,
  overrides: Partial<ParsedProductImportRow> = {},
): ParsedProductImportRow {
  return {
    rowNumber: 1,
    rawText: `${code}\t${price}`,
    parsedCode: code,
    parsedName: `Product ${code}`,
    parsedDosageVial: null,
    parsedDescription: null,
    parsedCategory: null,
    parsedPriceUsd: price,
    parsedBulkPriceUsd: null,
    parsedBulkPriceMinQuantity: null,
    parsedIsActive: null,
    quality: "ok",
    qualityReason: null,
    extraFields: null,
    ...overrides,
  };
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("forwardFillVendorNames", () => {
  it("fills empty follow-up variant names from the previous named row", () => {
    const filled = forwardFillVendorNames([
      makeImportRow("KP10", 60.85, { parsedName: "KPV", parsedDosageVial: "10mg*10vials" }),
      makeImportRow("KP30", 118, { parsedName: null, parsedDosageVial: "30mg*10vials" }),
      makeImportRow("KP50", 150, { parsedName: "", parsedDosageVial: "50mg*10vials" }),
    ]);
    expect(filled.map((row) => row.parsedName)).toEqual(["KPV", "KPV", "KPV"]);
  });
});

describe("vendor variants stay separate", () => {
  it("keeps KP10, KP30 and KP50 as three dealer rows even without a master product", () => {
    const { matched } = matchVendorCatalogRows(
      [
        makeImportRow("KP10", 60.85, { parsedName: "KPV", parsedDosageVial: "10mg*10vials" }),
        makeImportRow("KP30", 118, { parsedName: null, parsedDosageVial: "30mg*10vials" }),
        makeImportRow("KP50", 150, { parsedName: null, parsedDosageVial: "50mg*10vials" }),
      ],
      [makeProduct("KP10")],
    );
    expect(matched.map((row) => row.code)).toEqual(["KP10", "KP30", "KP50"]);
    expect(matched.map((row) => row.product_id)).toEqual(["id-kp10", null, null]);
    expect(matched.map((row) => row.name)).toEqual(["KPV", "KPV", "KPV"]);
    expect(matched.map((row) => row.dosage_vial)).toEqual(["10mg*10vials", "30mg*10vials", "50mg*10vials"]);
  });

  it("keeps BA3 and BA10 as two dealer rows", () => {
    const { matched } = matchVendorCatalogRows(
      [
        makeImportRow("BA3", 5, { parsedName: "BAC Water", parsedDosageVial: "3ml*10vials" }),
        makeImportRow("BA10", 7, { parsedName: null, parsedDosageVial: "10ml*10vials" }),
      ],
      [makeProduct("BA10")],
    );
    expect(matched.map((row) => row.code)).toEqual(["BA3", "BA10"]);
    expect(matched.find((row) => row.code === "BA3")?.product_id).toBeNull();
    expect(matched.find((row) => row.code === "BA10")?.product_id).toBe("id-ba10");
  });

  it("does not invent rows without a code or without a price", () => {
    const { matched, unmatched } = matchVendorCatalogRows(
      [
        makeImportRow("KP10", 60, { parsedName: "KPV" }),
        { ...makeImportRow("375", 0, { parsedCode: "375", parsedName: "LL37", parsedPriceUsd: 0 }) },
        { ...makeImportRow("", 10, { parsedCode: null, parsedName: null, parsedDosageVial: "10mg*10vials" }) },
      ],
      [],
    );
    expect(matched.map((row) => row.code)).toEqual(["KP10"]);
    expect(unmatched.some((row) => row.code === "375" && row.reason === "no_price")).toBe(true);
  });
});

describe("Emma Group Buy 1 dealer file", () => {
  it("parses the real spreadsheet into 136 importable dealer rows", async () => {
    const buffer = readFileSync(EMMA_XLSX);
    const file = new File([buffer], "Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseVendorCatalogFile(file);
    const withCode = parsed.rows.filter((row) => row.parsedCode);
    const result = matchVendorCatalogRows(parsed.rows, []);

    expect(result.matched).toHaveLength(136);
    expect(result.matched).toHaveLength(withCode.filter((row) => row.parsedPriceUsd && row.parsedPriceUsd > 0).length);
    expect(result.unlinkedCodes).toHaveLength(136);
    expect(result.unmatched.filter((row) => row.reason === "no_price").length).toBeLessThanOrEqual(3);

    const codes = new Set(result.matched.map((row) => row.code));
    for (const code of REQUIRED_UNLINKED_SKUS) {
      expect(codes.has(normalizeVendorSku(code))).toBe(true);
    }
    expect(codes.has("KP10")).toBe(true);
    expect(codes.has("KP30")).toBe(true);
    expect(codes.has("KP50")).toBe(true);
    expect(codes.has("BA3")).toBe(true);
    expect(codes.has("BA10")).toBe(true);

    const kpvNames = result.matched
      .filter((row) => ["KP10", "KP30", "KP50"].includes(row.code))
      .map((row) => (row.name ?? "").toUpperCase());
    expect(kpvNames).toHaveLength(3);
    expect(new Set(kpvNames).size).toBe(1);

    const water = result.matched.filter((row) => ["BA3", "BA10"].includes(row.code));
    expect(water).toHaveLength(2);
  });

  it("links only SKUs that exist in the global master and still imports the rest", async () => {
    const buffer = readFileSync(EMMA_XLSX);
    const file = new File([buffer], "Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseVendorCatalogFile(file);
    const master = [makeProduct("KP10"), makeProduct("BA10"), makeProduct("SM5")];
    const result = matchVendorCatalogRows(parsed.rows, master);
    expect(result.matched.find((row) => row.code === "KP10")?.product_id).toBe("id-kp10");
    expect(result.matched.find((row) => row.code === "KP30")?.product_id).toBeNull();
    expect(result.unlinkedCodes).toContain("KP30");
    expect(result.unlinkedCodes).not.toContain("KP10");
    expect(result.matched).toHaveLength(136);
    expect(result.unlinkedCodes).toHaveLength(result.matched.filter((row) => row.product_id == null).length);
    expect(result.matched.filter((row) => row.product_id != null).map((row) => row.code).sort()).toEqual(
      ["BA10", "KP10", "SM5"].filter((code) => result.matched.some((row) => row.code === code)).sort(),
    );
  });
});

describe("migration 0068 vendor-first catalog", () => {
  const sql = read("supabase/migrations/0068_vendor_catalog_optional_product.sql");

  it("makes product_id optional and keys the area catalog on vendor_code", () => {
    expect(sql).toContain("add column if not exists vendor_code text");
    expect(sql).toContain("alter column product_id drop not null");
    expect(sql).toContain("add primary key (shop_area_key, vendor_code)");
    expect(sql).toContain("create unique index if not exists shop_area_products_linked_product_uidx");
    expect(sql).toContain("create or replace function public.resolve_area_catalog_product");
    expect(sql).toContain("from public.shop_area_products");
    expect(sql).toContain("vendor_catalog_as_product");
    expect(sql).not.toMatch(/update public\.products set price_usd/);
    expect(sql).not.toMatch(/insert into public\.products/);
  });

  it("imports dealer rows without a master product and keeps manual prices by vendor_code", () => {
    expect(sql).toContain("if _product_id is not null and not exists");
    expect(sql).toContain("_product_id := null");
    expect(sql).toContain("'vendor_code', vendor_code");
    expect(sql).toContain("set_area_vendor_manual_price");
    expect(sql).toContain("set_area_vendor_category");
  });

  it("keeps fail-closed checkout and recomputes catalog prices server-side", () => {
    expect(sql).toContain("Ein Produkt gehört nicht zum aktuellen Händlerkatalog.");
    expect(sql).toContain("resolve_area_catalog_product(_area, _code, _item.product_id)");
    expect(sql).toContain("shop_area_sell_unit_price");
    expect(sql).toContain("sap.vendor_code = upper(btrim(coalesce(");
  });

  it("storefront assignments do not inner-join products", () => {
    expect(sql).toContain("coalesce(sap.product_id, sap.id)");
    expect(sql).not.toMatch(/inner join public\.products/i);
    expect(sql).toContain("shop_area_products_linked_product_uidx");
  });

  it("does not rewrite historical orders or the global product master", () => {
    expect(sql).not.toMatch(/update public\.order_items/);
    expect(sql).not.toMatch(/delete from public\.order_items/);
    expect(sql).not.toMatch(/delete from public\.orders/);
    expect(sql).not.toMatch(/update public\.products/);
    expect(sql).toContain("delete from public.shop_area_products where shop_area_key = _area_key");
  });
});

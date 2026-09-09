import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyRoleMarkup } from "@/lib/money";
import {
  areaPriceSource,
  effectiveAreaPriceUsd,
  shopAreaCatalogUnit,
  shopAreaSellUnitPrice,
  shopAreaSellUnitPriceForProductRole,
} from "@/lib/shop/shopAreaPricing";
import { vendorOverrideConflicts, type VendorCatalogEntry } from "@/lib/shop/vendorCatalog";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const KIT = { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null };

describe("area grundpreis overrides", () => {
  it("1 – imported vendor price is the area grundpreis", () => {
    expect(effectiveAreaPriceUsd(80, null)).toBe(80);
    expect(areaPriceSource(null)).toBe("vendor_file");
  });

  it("2 – manual grundpreis overrides the imported price", () => {
    expect(effectiveAreaPriceUsd(80, 85)).toBe(85);
    expect(areaPriceSource(85)).toBe("manual");
  });

  it("3 – clearing the override restores the imported price", () => {
    expect(effectiveAreaPriceUsd(80, 85)).toBe(85);
    expect(effectiveAreaPriceUsd(80, null)).toBe(80);
    expect(areaPriceSource(null)).toBe("vendor_file");
  });

  it("4 – global products.price_usd is not used when an area price exists", () => {
    const global = { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null };
    const shop = shopAreaSellUnitPriceForProductRole(global, 1, 25, "retail", true, 80, null, 300);
    expect(shop).toBe(shopAreaSellUnitPrice({ price_usd: 80 }, 1, 25, "retail", true, 300));
    expect(shop).not.toBe(shopAreaSellUnitPrice(global, 1, 25, "retail", true, 300));
  });

  it("5 – Shop factor 300% is applied after the grundpreis", () => {
    const base = shopAreaCatalogUnit(KIT, 1, "retail", true, 300);
    expect(base).toBe(30);
    expect(applyRoleMarkup(base, 25)).toBe(37.5);
  });

  it("6 – GB1 factor 100% is a pass-through before role markup", () => {
    const base = shopAreaCatalogUnit(KIT, 1, "group_buy", false, 100);
    expect(base).toBe(100);
    expect(applyRoleMarkup(base, 25)).toBe(125);
  });

  it("7 – GB2 factor 100% matches GB1 unless the factor changes", () => {
    expect(shopAreaCatalogUnit(KIT, 1, "group_buy", false, 100)).toBe(100);
    expect(shopAreaSellUnitPrice(KIT, 1, 25, "group_buy", false, 150)).toBe(187.5);
  });

  it("8 – role markup is applied exactly once", () => {
    const once = shopAreaSellUnitPrice(KIT, 1, 25, "group_buy", false, 100);
    const twice = applyRoleMarkup(once, 25);
    expect(once).toBe(125);
    expect(twice).toBe(156.25);
  });

  it("9 – retail kit/10 vial math stays on the existing pipeline", () => {
    expect(shopAreaSellUnitPrice(KIT, 1, 25, "retail", true, 300)).toBe(37.5);
    expect(shopAreaSellUnitPrice(KIT, 1, 25, "retail", false, 300)).toBe(375);
  });

  it("10 – group-buy kit grundpreis is not divided by 10", () => {
    expect(shopAreaSellUnitPrice(KIT, 1, 25, "group_buy", true, 100)).toBe(125);
  });

  it("11 – Shop / GB1 / GB2 prices stay isolated", () => {
    const shop = shopAreaSellUnitPriceForProductRole(KIT, 1, 25, "retail", true, 80, null, 300);
    const gb1 = shopAreaSellUnitPriceForProductRole(KIT, 1, 25, "group_buy", true, 75, null, 100);
    const gb2 = shopAreaSellUnitPriceForProductRole(KIT, 1, 25, "group_buy", true, 90, null, 100);
    expect(shop).toBe(30);
    expect(gb1).toBe(93.75);
    expect(gb2).toBe(112.5);
    expect(new Set([shop, gb1, gb2]).size).toBe(3);
  });

  it("15 – a manual override stays distinguishable from the import price", () => {
    expect(areaPriceSource(85)).toBe("manual");
    expect(effectiveAreaPriceUsd(80, 85)).not.toBe(80);
  });

  it("16 – re-import lists remaining manual overrides instead of dropping them silently", () => {
    const matched: VendorCatalogEntry[] = [
      {
        product_id: "id-sm5",
        code: "SM5",
        name: "Selank",
        dosage_vial: "5 mg",
        price_usd: 82,
        bulk_price_usd: null,
        bulk_price_min_quantity: null,
        vendor_raw: {},
        imported_category_key: "peptides",
      },
    ];
    const conflicts = vendorOverrideConflicts(matched, [
      { product_id: "id-sm5", imported_price_usd: 80, manual_price_usd: 85 },
      { product_id: "id-gone", imported_price_usd: 10, manual_price_usd: 12 },
    ]);
    expect(conflicts).toEqual([
      {
        product_id: "id-sm5",
        code: "SM5",
        newImportedUsd: 82,
        currentImportedUsd: 80,
        currentManualUsd: 85,
      },
    ]);
  });

  it("17 – empty matched file means empty area catalog", () => {
    expect(vendorOverrideConflicts([], [{ product_id: "id-sm5", imported_price_usd: 80, manual_price_usd: 85 }])).toEqual(
      [],
    );
  });
});

describe("0058 area manual prices SQL", () => {
  const sql = read("supabase/migrations/0058_area_manual_prices.sql");
  const sql0056 = read("supabase/migrations/0056_area_vendor_catalog.sql");

  it("extends shop_area_product_prices and never writes products.price_usd", () => {
    expect(sql).toContain("imported_price_usd");
    expect(sql).toContain("manual_price_usd");
    expect(sql).toContain("set_area_product_manual_price");
    expect(sql).toContain("_keep_manual_overrides");
    expect(sql).toContain("coalesce(NEW.manual_price_usd, NEW.imported_price_usd)");
    expect(sql).not.toMatch(/update public\.products/);
    expect(sql).not.toMatch(/insert into public\.products/);
  });

  it("12–14 – 0056 fail-closed checkout is unchanged", () => {
    expect(sql0056).toContain("Ein Produkt gehört nicht zum aktuellen Händlerkatalog.");
    expect(sql0056).toMatch(/raise exception 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog\.'/);
    expect(sql).not.toContain("create_order");
  });
});

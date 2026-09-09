import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyRoleMarkup, getEffectiveUnitPrice, sellingUnitPrice } from "@/lib/money";
import { shopAreaCatalogUnit, shopAreaSellUnitPriceForProductRole } from "@/lib/shop/shopAreaPricing";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const TIERED = { price_usd: 100, bulk_price_usd: 80, bulk_price_min_quantity: 10 };
const TIERED_20 = { price_usd: 100, bulk_price_usd: 75, bulk_price_min_quantity: 20 };

describe("global quantity discount switch", () => {
  it("keeps existing tiers when discounts are enabled", () => {
    expect(getEffectiveUnitPrice(TIERED, 1, true).unitPriceUsd).toBe(100);
    expect(getEffectiveUnitPrice(TIERED, 10, true).unitPriceUsd).toBe(80);
    expect(getEffectiveUnitPrice(TIERED_20, 20, true).unitPriceUsd).toBe(75);
    expect(getEffectiveUnitPrice(TIERED, 10, true).tier).toBe("bulk");
  });

  it("uses the normal base price for 1, 10 and 20 units when discounts are off", () => {
    expect(getEffectiveUnitPrice(TIERED, 1, false).unitPriceUsd).toBe(100);
    expect(getEffectiveUnitPrice(TIERED, 10, false).unitPriceUsd).toBe(100);
    expect(getEffectiveUnitPrice(TIERED_20, 20, false).unitPriceUsd).toBe(100);
    expect(getEffectiveUnitPrice(TIERED, 10, false).tier).toBe("normal");
    expect(getEffectiveUnitPrice(TIERED, 10, false).bulkPriceUsd).toBeNull();
  });

  it("keeps role markup and area factor while discounts are off", () => {
    const retail = shopAreaSellUnitPriceForProductRole(TIERED, 10, 25, "retail", true, null, null, 300, false);
    expect(retail).toBe(37.5);
    expect(shopAreaSellUnitPriceForProductRole(TIERED, 1, 25, "retail", true, null, null, 300, false)).toBe(37.5);
    expect(shopAreaSellUnitPriceForProductRole(TIERED, 20, 25, "retail", true, null, null, 300, false)).toBe(37.5);

    expect(shopAreaCatalogUnit(TIERED, 10, "group_buy", true, 100, 10, false)).toBe(100);
    expect(shopAreaSellUnitPriceForProductRole(TIERED, 10, 25, "group_buy", true, null, null, 100, false)).toBe(125);
    expect(shopAreaSellUnitPriceForProductRole(TIERED, 10, 25, "group_buy", true, null, null, 150, false)).toBe(187.5);
    expect(applyRoleMarkup(100, 25)).toBe(125);
  });

  it("keeps retail kit divisor independent of quantity when discounts are on or off", () => {
    expect(shopAreaCatalogUnit(TIERED, 1, "retail", true, 300)).toBe(30);
    expect(shopAreaCatalogUnit(TIERED, 10, "retail", true, 300, 10, false)).toBe(30);
  });

  it("does not let a client-supplied quantity force bulk when discounts are off", () => {
    expect(sellingUnitPrice(TIERED, 10, 25, false)).toBe(sellingUnitPrice(TIERED, 1, 25, false));
    expect(sellingUnitPrice(TIERED, 10, 25, false)).toBe(125);
    expect(sellingUnitPrice(TIERED, 10, 25, true)).toBe(100);
  });

  it("hides the bulk column in shop tables only when discounts are disabled", () => {
    const desktop = read("src/components/shop/ShopProductsTable.tsx");
    const mobile = read("src/components/shop/ShopProductsMobileList.tsx");
    expect(desktop).toContain("showBulkColumn = !isRetailPricing(pricingProfile) && quantityDiscountsEnabled");
    expect(mobile).toContain("showBulkColumn = !isRetailPricing(pricingProfile) && quantityDiscountsEnabled");
  });

  it("wires the SQL pricing SSoT and checkout to the same global flag", () => {
    const sql = read("supabase/migrations/0061_app_settings.sql");
    expect(sql).toContain("quantity_discounts_enabled");
    expect(sql).toContain("create or replace function public.sell_unit_price");
    expect(sql).toContain("when public.quantity_discounts_enabled()");
    expect(sql).toContain("create or replace function public.sync_cart_selling_prices");
    expect(sql).toContain("create or replace function public.create_order");
    expect(sql).toContain("perform public.assert_public_site_access()");
    expect(sql).toMatch(/elsif public\.quantity_discounts_enabled\(\)/);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/drop column/i);
  });
});

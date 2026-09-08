import { describe, expect, it } from "vitest";

import { shopAreaCatalogUnit, shopAreaSellUnitPrice } from "@/lib/shop/shopAreaPricing";

const PEPTIDE_KIT = { price_usd: 100, bulk_price_usd: 90, bulk_price_min_quantity: 10 };
const OIL = { price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 };
const ORAL = { price_usd: 20, bulk_price_usd: 18, bulk_price_min_quantity: 10 };

describe("shop area pricing pipeline", () => {
  it("converts peptide kits to retail vial price as kit/10×5", () => {
    expect(shopAreaCatalogUnit(PEPTIDE_KIT, 1, "retail", true)).toBe(50);
    expect(shopAreaCatalogUnit({ price_usd: 120 }, 1, "retail", true)).toBe(60);
  });

  it("multiplies oil and oral units by 5 in retail after the existing unit", () => {
    expect(shopAreaCatalogUnit(OIL, 1, "retail", false)).toBe(90);
    expect(shopAreaCatalogUnit(ORAL, 1, "retail", false)).toBe(100);
  });

  it("keeps group-buy catalog math on the existing quantity-tier unit", () => {
    expect(shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", true)).toBe(100);
    expect(shopAreaCatalogUnit(OIL, 1, "group_buy", false)).toBe(18);
    expect(shopAreaCatalogUnit(OIL, 10, "group_buy", false)).toBe(16);
  });

  it("applies role markup exactly once after the area formula", () => {
    expect(shopAreaSellUnitPrice(PEPTIDE_KIT, 1, 25, "retail", true)).toBe(62.5);
    expect(shopAreaSellUnitPrice(PEPTIDE_KIT, 1, 25, "group_buy", true)).toBe(125);
    expect(shopAreaSellUnitPrice(OIL, 1, 0, "retail", false)).toBe(90);
  });
});

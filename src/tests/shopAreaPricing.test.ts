import { describe, expect, it } from "vitest";

import { applyRoleMarkup } from "@/lib/money";
import {
  shopAreaCatalogUnit,
  shopAreaSellUnitPrice,
  shopAreaSellUnitPriceForProductRole,
} from "@/lib/shop/shopAreaPricing";

const PEPTIDE_KIT = { price_usd: 100, bulk_price_usd: 90, bulk_price_min_quantity: 10 };
const OIL = { price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 };
const ORAL = { price_usd: 20, bulk_price_usd: 18, bulk_price_min_quantity: 10 };

describe("shop area pricing pipeline", () => {
  // -------------------------------------------------------------------------
  // Existing tests: explicit factorPct=500 preserves old factor=5 behavior.
  // These verify the formula path is correct; the production default is now 100.
  // -------------------------------------------------------------------------

  it("converts peptide kits to retail vial price as kit/10×factor (factorPct=500 → 5×)", () => {
    expect(shopAreaCatalogUnit(PEPTIDE_KIT, 1, "retail", true, 500)).toBe(50);
    expect(shopAreaCatalogUnit({ price_usd: 120 }, 1, "retail", true, 500)).toBe(60);
  });

  it("multiplies oil and oral units by factor in retail after quantity-tier unit (factorPct=500)", () => {
    expect(shopAreaCatalogUnit(OIL, 1, "retail", false, 500)).toBe(90);
    expect(shopAreaCatalogUnit(ORAL, 1, "retail", false, 500)).toBe(100);
  });

  it("keeps group-buy catalog math on the existing quantity-tier unit (default factorPct=100 → 1×)", () => {
    expect(shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", true)).toBe(100);
    expect(shopAreaCatalogUnit(OIL, 1, "group_buy", false)).toBe(18);
    expect(shopAreaCatalogUnit(OIL, 10, "group_buy", false)).toBe(16);
  });

  it("applies role markup exactly once after the area formula", () => {
    expect(shopAreaSellUnitPrice(PEPTIDE_KIT, 1, 25, "retail", true, 500)).toBe(62.5);
    expect(shopAreaSellUnitPrice(PEPTIDE_KIT, 1, 25, "group_buy", true)).toBe(125);
    expect(shopAreaSellUnitPrice(OIL, 1, 0, "retail", false, 500)).toBe(90);
  });

  it("lets the same product have independent prices per area and role", () => {
    const product = PEPTIDE_KIT;
    // Retail: price override=40, usesKit=true, factorPct=500, markup=25%: 40/10×5×1.25=25
    const shopPrice = shopAreaSellUnitPriceForProductRole(product, 1, 25, "retail", true, 40, 25, 500);
    // GB1: price override=15, markup=0, factorPct=100 (default): 15×1×1=15
    const gb1Price = shopAreaSellUnitPriceForProductRole(product, 1, 25, "group_buy", true, 15, 0);
    // GB2: price override=16, markup=0, factorPct=100 (default): 16×1×1=16
    const gb2Price = shopAreaSellUnitPriceForProductRole(product, 1, 25, "group_buy", true, 16, 0);
    expect(shopPrice).toBe(25);
    expect(gb1Price).toBe(15);
    expect(gb2Price).toBe(16);
    expect(new Set([shopPrice, gb1Price, gb2Price]).size).toBe(3);
  });

  it("keeps the 25 percent role model when no area markup override exists", () => {
    expect(shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", true)).toBe(125);
    expect(shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", true, null, 15)).toBe(115);
  });

  // -------------------------------------------------------------------------
  // New tests: base_price_factor_pct semantics (percentage → multiplier).
  // Production values: retail shop = 300 %, group_buy = 100 %.
  // -------------------------------------------------------------------------

  describe("area base price factor pricing (base_price_factor_pct)", () => {
    // Retail: importPrice=100, factor=300%, role=25% → (100/10) × 3.0 × 1.25 = 37.50
    it("retail: importPrice=100, factor=300%, role=25% → 37.50", () => {
      const product = { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null };
      const base = shopAreaCatalogUnit(product, 1, "retail", true, 300, 10);
      expect(base).toBe(30); // 100/10 × 3 = 30
      const withMarkup = applyRoleMarkup(base, 25);
      expect(withMarkup).toBe(37.5);
    });

    // Retail: role=0%
    it("retail: importPrice=100, factor=300%, role=0% → 30.00", () => {
      const base = shopAreaCatalogUnit(
        { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null },
        1,
        "retail",
        true,
        300,
        10,
      );
      expect(base).toBe(30);
      expect(applyRoleMarkup(base, 0)).toBe(30);
    });

    // GB1: importPrice=100, factor=100%, role=25% → 100 × 1.0 × 1.25 = 125
    it("group_buy: importPrice=100, factor=100%, role=25% → 125.00", () => {
      const product = { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null };
      const base = shopAreaCatalogUnit(product, 1, "group_buy", false, 100, 10);
      expect(base).toBe(100); // 100 × 1.0 = 100
      expect(applyRoleMarkup(base, 25)).toBe(125);
    });

    // GB1: role=0%
    it("group_buy: importPrice=100, factor=100%, role=0% → 100.00", () => {
      const base = shopAreaCatalogUnit(
        { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null },
        1,
        "group_buy",
        false,
        100,
        10,
      );
      expect(base).toBe(100);
      expect(applyRoleMarkup(base, 0)).toBe(100);
    });

    // GB2: importPrice=100, factor=150%, role=25% → 100 × 1.5 × 1.25 = 187.50
    it("group_buy: importPrice=100, factor=150%, role=25% → 187.50", () => {
      const product = { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null };
      const base = shopAreaCatalogUnit(product, 1, "group_buy", false, 150, 10);
      expect(base).toBe(150); // 100 × 1.5 = 150
      expect(applyRoleMarkup(base, 25)).toBe(187.5);
    });

    // GB2: role=0%
    it("group_buy: importPrice=100, factor=150%, role=0% → 150.00", () => {
      const base = shopAreaCatalogUnit(
        { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null },
        1,
        "group_buy",
        false,
        150,
        10,
      );
      expect(base).toBe(150);
    });

    // Negativtest: retail × 300% must NOT give 375 or 400
    it("retail 100/10×3×1.25 is 37.50 not 375 or 400", () => {
      const base = shopAreaCatalogUnit(
        { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null },
        1,
        "retail",
        true,
        300,
        10,
      );
      const withMarkup = applyRoleMarkup(base, 25);
      expect(withMarkup).toBe(37.5);
      expect(withMarkup).not.toBe(375);
      expect(withMarkup).not.toBe(400);
    });

    // No double markup
    it("no double markup: applyRoleMarkup called exactly once", () => {
      const base = shopAreaCatalogUnit(
        { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null },
        1,
        "retail",
        true,
        300,
        10,
      );
      // 30 × 1.25 = 37.5 (once)
      // 37.5 × 1.25 = 46.875 (twice — must NOT be 37.5)
      const once = applyRoleMarkup(base, 25);
      const twice = applyRoleMarkup(once, 25);
      expect(once).toBe(37.5);
      expect(twice).not.toBe(37.5); // proves double application yields a different value
    });

    // Default factorPct=100 is a neutral pass-through (1×)
    it("default factorPct=100 is a neutral pass-through for group_buy", () => {
      const base = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", false); // default factorPct=100
      expect(base).toBe(100); // 100 × 1.0 = 100
    });

    // Percentage semantics: 300% means 3×, not 4× (not 1 + 3.0)
    it("300% means 3× multiplier, not 4× (not 1 + 3.0)", () => {
      const base300 = shopAreaCatalogUnit({ price_usd: 100 }, 1, "retail", false, 300);
      const base400 = shopAreaCatalogUnit({ price_usd: 100 }, 1, "retail", false, 400);
      expect(base300).toBe(300); // 100 × 3.0
      expect(base400).toBe(400); // 100 × 4.0
      expect(base300).not.toBe(400); // 300% ≠ 4×
    });
  });
});

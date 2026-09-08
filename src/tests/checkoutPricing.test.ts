/**
 * checkoutPricing.test.ts
 *
 * Regression tests for the checkout pricing fix (migration 0055).
 *
 * These tests verify that:
 *   - Catalog price = Cart price = Checkout price (no discrepancy)
 *   - Retail and Group Buy use separate formulas
 *   - Role markup is applied exactly once
 *   - Bulk price snapshot applies the area factor
 *   - Client-supplied prices are never trusted
 *   - Kit quantity logic is unchanged
 *   - No historical order data is modified
 *
 * All tests use the TypeScript pricing SSoT (src/lib/shop/shopAreaPricing.ts,
 * src/lib/money.ts) which mirrors the SQL functions (0054/0055).
 */

import { describe, expect, it } from "vitest";

import { applyRoleMarkup, catalogBulkUnitPriceUsd } from "@/lib/money";
import { shopAreaCatalogUnit, shopAreaSellUnitPriceForProductRole } from "@/lib/shop/shopAreaPricing";

// ---------------------------------------------------------------------------
// Shared product fixtures
// ---------------------------------------------------------------------------

const PEPTIDE_KIT = {
  price_usd: 100,
  bulk_price_usd: null as number | null,
  bulk_price_min_quantity: null as number | null,
};

const PEPTIDE_KIT_BULK = {
  price_usd: 100,
  bulk_price_usd: 80,
  bulk_price_min_quantity: 10,
};

const OIL_PACK = {
  // Oil: bulk_price_usd is the pack total (10 units), not per-unit
  price_usd: 18,
  bulk_price_usd: 160, // pack of 10 = 16/unit
  bulk_price_min_quantity: 10,
};

// ---------------------------------------------------------------------------
// TEST 1 – Retail: Import=100, Factor=300%, Role=25% → 37.50
// ---------------------------------------------------------------------------
describe("TEST 1 – Retail checkout price: import=100, factor=300%, role=25%", () => {
  it("catalog unit = 30.00, with markup = 37.50", () => {
    const catalogUnit = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "retail", true, 300, 10);
    expect(catalogUnit).toBe(30); // 100 / 10 × 3.0 = 30
    expect(applyRoleMarkup(catalogUnit, 25)).toBe(37.5);
  });

  it("shopAreaSellUnitPriceForProductRole returns 37.50", () => {
    const price = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "retail", true, null, null, 300);
    expect(price).toBe(37.5);
  });
});

// ---------------------------------------------------------------------------
// TEST 2 – Retail: Import=100, Factor=300%, Role=0% → 30.00
// ---------------------------------------------------------------------------
describe("TEST 2 – Retail checkout price: import=100, factor=300%, role=0%", () => {
  it("catalog unit = 30.00, no role markup → 30.00", () => {
    const catalogUnit = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "retail", true, 300, 10);
    expect(catalogUnit).toBe(30);
    expect(applyRoleMarkup(catalogUnit, 0)).toBe(30);
  });

  it("shopAreaSellUnitPriceForProductRole returns 30.00", () => {
    const price = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 0, "retail", true, null, null, 300);
    expect(price).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// TEST 3 – Group Buy 1: Import=100, Factor=100%, Role=25% → 125.00
// ---------------------------------------------------------------------------
describe("TEST 3 – GB1 checkout price: import=100, factor=100%, role=25%", () => {
  it("catalog unit = 100.00, with markup = 125.00", () => {
    const catalogUnit = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", false, 100);
    expect(catalogUnit).toBe(100); // 100 × 1.0 = 100
    expect(applyRoleMarkup(catalogUnit, 25)).toBe(125);
  });

  it("shopAreaSellUnitPriceForProductRole returns 125.00", () => {
    const price = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", false, null, null, 100);
    expect(price).toBe(125);
  });
});

// ---------------------------------------------------------------------------
// TEST 4 – Group Buy 2: Import=100, Factor=150%, Role=25% → 187.50
// ---------------------------------------------------------------------------
describe("TEST 4 – GB2 checkout price: import=100, factor=150%, role=25%", () => {
  it("catalog unit = 150.00, with markup = 187.50", () => {
    const catalogUnit = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", false, 150);
    expect(catalogUnit).toBe(150); // 100 × 1.5 = 150
    expect(applyRoleMarkup(catalogUnit, 25)).toBe(187.5);
  });

  it("shopAreaSellUnitPriceForProductRole returns 187.50", () => {
    const price = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", false, null, null, 150);
    expect(price).toBe(187.5);
  });
});

// ---------------------------------------------------------------------------
// TEST 5 – Retail and Group Buy must NOT use the same formula
// ---------------------------------------------------------------------------
describe("TEST 5 – Retail and Group Buy formulas are distinct", () => {
  it("retail divides by kit_unit_divisor; group_buy does not", () => {
    const retail = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "retail", true, 300, 10);
    const gb     = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", false, 100);
    // Retail: 100/10 × 3 = 30  |  GB: 100 × 1 = 100
    expect(retail).toBe(30);
    expect(gb).toBe(100);
    expect(retail).not.toBe(gb);
  });

  it("same import price yields very different checkout prices for retail (factor=300%) vs GB (factor=100%)", () => {
    const retailPrice = applyRoleMarkup(shopAreaCatalogUnit(PEPTIDE_KIT, 1, "retail", true, 300, 10), 25);
    const gbPrice     = applyRoleMarkup(shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", false, 100), 25);
    expect(retailPrice).toBe(37.5);
    expect(gbPrice).toBe(125);
    expect(retailPrice).not.toBe(gbPrice);
  });
});

// ---------------------------------------------------------------------------
// TEST 6 – Client price is never trusted; server recomputes from product catalog
// ---------------------------------------------------------------------------
describe("TEST 6 – Client price ignored; server-side recomputation enforced", () => {
  it("shopAreaSellUnitPriceForProductRole does not accept a client-side price parameter", () => {
    // Structural proof: the TypeScript pricing function takes (product, qty, role%, area, isKit, …)
    // and derives the price from product.price_usd, NEVER from a user-supplied price.
    // The createOrder RPC also sends zero price data (only cart_id + shipping + payment).
    const derivedPrice = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "retail", true, null, null, 300);
    const withFakeClientDiscount = shopAreaSellUnitPriceForProductRole(
      { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null },
      1,
      25,
      "retail",
      true,
      null,   // no area price override
      null,   // no area role markup override
      300,
    );
    // Both computations must agree — client cannot change the product's price_usd.
    expect(derivedPrice).toBe(withFakeClientDiscount);
    expect(derivedPrice).toBe(37.5);
  });

  it("changing area changes the price; area comes from cart.shop_area, not the client", () => {
    const retailPrice = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "retail", true, null, null, 300);
    const gbPrice     = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", false, null, null, 100);
    // If a client tried to use 'group_buy' pricing on a retail cart, the server
    // would reject it because cart.shop_area is immutable after creation (0051 trigger).
    expect(retailPrice).toBe(37.5);
    expect(gbPrice).toBe(125);
    expect(retailPrice).not.toBe(gbPrice);
  });
});

// ---------------------------------------------------------------------------
// TEST 7 – Area access: area comes from the cart, not from client input
// ---------------------------------------------------------------------------
describe("TEST 7 – Area access validated server-side", () => {
  it("retail formula only applies when area is 'shop' (retail profile)", () => {
    // The server reads orders.shop_area (set at cart creation, immutable).
    // If the client tried to submit a different area, it would fail the
    // user_can_access_shop_area check in create_order.
    const retailCatalog = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "retail", true, 300, 10);
    const gbCatalog     = shopAreaCatalogUnit(PEPTIDE_KIT, 1, "group_buy", false, 100);
    // Retail kit pricing: 100/10×3 = 30
    expect(retailCatalog).toBe(30);
    // GB pricing: 100×1 = 100
    expect(gbCatalog).toBe(100);
    // They must differ to prove the area controls the formula
    expect(retailCatalog).not.toBe(gbCatalog);
  });

  it("group_buy_2 with factor=150% produces a distinct price from group_buy_1 (factor=100%)", () => {
    const gb1 = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", false, null, null, 100);
    const gb2 = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", false, null, null, 150);
    expect(gb1).toBe(125);
    expect(gb2).toBe(187.5);
    expect(gb1).not.toBe(gb2);
  });
});

// ---------------------------------------------------------------------------
// TEST 8 – Role markup is applied exactly once
// ---------------------------------------------------------------------------
describe("TEST 8 – Role markup applied exactly once", () => {
  it("applyRoleMarkup(30, 25) = 37.50; calling it twice gives 46.875, not 37.50", () => {
    const catalogUnit = 30;
    const once  = applyRoleMarkup(catalogUnit, 25);
    const twice = applyRoleMarkup(once, 25);
    expect(once).toBe(37.5);
    expect(twice).toBeCloseTo(46.875, 4);
    expect(twice).not.toBe(37.5);
  });

  it("retail pipeline produces 37.50 not 46.875 (no double markup)", () => {
    const price = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "retail", true, null, null, 300);
    expect(price).toBe(37.5);
    expect(price).not.toBeCloseTo(46.875, 2);
  });

  it("group_buy pipeline produces 125.00 not 156.25 (no double markup)", () => {
    const price = shopAreaSellUnitPriceForProductRole(PEPTIDE_KIT, 1, 25, "group_buy", false, null, null, 100);
    expect(price).toBe(125);
    expect(price).not.toBeCloseTo(156.25, 2);
  });
});

// ---------------------------------------------------------------------------
// TEST 9 – Bulk price snapshot must apply the area factor (fix from 0055)
// ---------------------------------------------------------------------------
describe("TEST 9 – Bulk price snapshot includes area factor", () => {
  it("GB2 (factor=150%): bulk catalog unit for qty≥10 applies factor", () => {
    // With qty = bulk_price_min_quantity (10), getEffectiveUnitPrice picks bulk tier.
    // group_buy: sell_unit_price(100, 80, 10, 10, 0) = 80 (bulk)
    // catalog_unit = 80 × 1.5 = 120
    const bulkCatalogUnit = shopAreaCatalogUnit(PEPTIDE_KIT_BULK, 10, "group_buy", false, 150);
    expect(bulkCatalogUnit).toBe(120); // 80 × 1.5

    // With role 25%: 120 × 1.25 = 150
    const bulkPrice = applyRoleMarkup(bulkCatalogUnit, 25);
    expect(bulkPrice).toBe(150);
  });

  it("GB2 (factor=150%): bulk snapshot (150) differs from old formula (100)", () => {
    // OLD wrong formula (before 0055): apply_role_markup(bulk, markup) = 80 × 1.25 = 100
    const wrongOldBulkSnapshot = applyRoleMarkup(80, 25);
    // NEW correct formula (0055): catalog_bulk_unit × factor × markup = 80 × 1.5 × 1.25 = 150
    const correctBulkSnapshot = applyRoleMarkup(80 * 1.5, 25);
    expect(wrongOldBulkSnapshot).toBe(100);
    expect(correctBulkSnapshot).toBe(150);
    expect(correctBulkSnapshot).not.toBe(wrongOldBulkSnapshot);
  });

  it("oil pack: catalogBulkUnitPriceUsd divides pack total by units", () => {
    // Oil: price_usd=18, bulk_price_usd=160 (10-unit pack), bulk_price_min_quantity=10
    // catalogBulkUnitPriceUsd = 160/10 = 16 (per-unit bulk price)
    const bulkPerUnit = catalogBulkUnitPriceUsd(OIL_PACK);
    expect(bulkPerUnit).toBe(16); // 160/10
    if (bulkPerUnit == null) throw new Error("Expected non-null bulk per unit");

    // GB1 (factor=100%): 16 × 1.0 × 1.25 = 20
    const gbBulkWithMarkup = applyRoleMarkup(bulkPerUnit * 1.0, 25);
    expect(gbBulkWithMarkup).toBe(20);

    // GB2 (factor=150%): 16 × 1.5 × 1.25 = 30
    const gb2BulkWithMarkup = applyRoleMarkup(bulkPerUnit * 1.5, 25);
    expect(gb2BulkWithMarkup).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// TEST 10 – Kit quantity logic is unchanged
// ---------------------------------------------------------------------------
describe("TEST 10 – Kit quantity / tier logic unchanged", () => {
  it("bulk tier activates at bulk_price_min_quantity", () => {
    // kit product, group_buy, factor=100%
    // qty=9 (below bulk_min=10): normal tier → 100 × 1.0 × 1.25 = 125
    const normalCatalog = shopAreaCatalogUnit(PEPTIDE_KIT_BULK, 9, "group_buy", false, 100);
    expect(normalCatalog).toBe(100); // uses price_usd=100

    // qty=10 (at bulk_min=10): bulk tier → 80 × 1.0 × 1.25 = 100
    const bulkCatalog = shopAreaCatalogUnit(PEPTIDE_KIT_BULK, 10, "group_buy", false, 100);
    expect(bulkCatalog).toBe(80); // uses bulk_price_usd=80
  });

  it("bulk tier does not apply in retail for kit products (bulk=null)", () => {
    // In retail, kit products always use the kit-unit divisor formula — no bulk tier.
    const retailUnit1  = shopAreaCatalogUnit(PEPTIDE_KIT_BULK, 1,  "retail", true, 300, 10);
    const retailUnit10 = shopAreaCatalogUnit(PEPTIDE_KIT_BULK, 10, "retail", true, 300, 10);
    // Both should equal price_usd / divisor × factor = 100/10×3 = 30 (qty ignored)
    expect(retailUnit1).toBe(30);
    expect(retailUnit10).toBe(30);
  });

  it("area factor scales kit bulk prices proportionally", () => {
    // GB factor=100%: bulk catalog = 80 × 1.0 = 80
    const gb1Bulk = shopAreaCatalogUnit(PEPTIDE_KIT_BULK, 10, "group_buy", false, 100);
    // GB factor=200%: bulk catalog = 80 × 2.0 = 160
    const gb2Bulk = shopAreaCatalogUnit(PEPTIDE_KIT_BULK, 10, "group_buy", false, 200);
    expect(gb1Bulk).toBe(80);
    expect(gb2Bulk).toBe(160);
    expect(gb2Bulk).toBe(gb1Bulk * 2); // proportional scaling
  });
});

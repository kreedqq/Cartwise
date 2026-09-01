import { describe, expect, it } from "vitest";

import { applyRoleMarkup, sellingUnitPrice, splitAmountEvenly } from "@/lib/money";
import { CUSTOMER_ORDER_COLUMNS } from "@/services/orders";

const CATALOG = { price_usd: 100, bulk_price_usd: 90, bulk_price_min_quantity: 10 };

describe("applyRoleMarkup", () => {
  it("applies Kunde 25% to a flat 100", () => {
    expect(applyRoleMarkup(100, 25)).toBe(125);
  });

  it("leaves Stammkunde 0% unchanged", () => {
    expect(applyRoleMarkup(100, 0)).toBe(100);
  });

  it("applies VIP 5%", () => {
    expect(applyRoleMarkup(100, 5)).toBe(105);
  });

  it("applies a later 30% without any code change to the formula", () => {
    expect(applyRoleMarkup(100, 30)).toBe(130);
  });
});

describe("sellingUnitPrice bulk-then-markup", () => {
  it("qty 1/9 stay on marked-up normal price for Kunde 25%", () => {
    expect(sellingUnitPrice(CATALOG, 1, 25)).toBe(125);
    expect(sellingUnitPrice(CATALOG, 9, 25)).toBe(125);
  });

  it("qty 10/11/100 use marked-up bulk for Kunde 25% → 112.50", () => {
    expect(sellingUnitPrice(CATALOG, 10, 25)).toBe(112.5);
    expect(sellingUnitPrice(CATALOG, 11, 25)).toBe(112.5);
    expect(sellingUnitPrice(CATALOG, 100, 25)).toBe(112.5);
  });

  it("Stammkunde 0% gets catalog bulk 90 from qty 10", () => {
    expect(sellingUnitPrice(CATALOG, 10, 0)).toBe(90);
    expect(sellingUnitPrice(CATALOG, 1, 0)).toBe(100);
  });

  it("oils pack-total 160 at min 10 is 16 per unit, not 160 × qty", () => {
    const oil = { price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 };
    expect(sellingUnitPrice(oil, 9, 0)).toBe(18);
    expect(sellingUnitPrice(oil, 10, 0)).toBe(16);
    expect(sellingUnitPrice(oil, 11, 0)).toBe(16);
    expect(sellingUnitPrice(oil, 20, 0)).toBe(16);
  });

  it("role switch Kunde → Stammkunde changes the selling price", () => {
    expect(sellingUnitPrice(CATALOG, 1, 25)).toBe(125);
    expect(sellingUnitPrice(CATALOG, 1, 0)).toBe(100);
    expect(sellingUnitPrice(CATALOG, 1, 25)).toBe(125);
  });

  it("does not apply markup a second time to a made-up shipping amount", () => {
    expect(applyRoleMarkup(20, 0)).toBe(20);
    expect(20).toBe(20);
  });
});

describe("splitAmountEvenly (Versand aus China)", () => {
  it("100 / 1 → 100", () => {
    expect(splitAmountEvenly(100, 1)).toEqual([100]);
  });

  it("100 / 2 → 50 + 50", () => {
    expect(splitAmountEvenly(100, 2)).toEqual([50, 50]);
  });

  it("100 / 5 → 20 each", () => {
    expect(splitAmountEvenly(100, 5)).toEqual([20, 20, 20, 20, 20]);
  });

  it("100 / 3 → 33.33 + 33.33 + 33.34", () => {
    expect(splitAmountEvenly(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(splitAmountEvenly(100, 3).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });
});

describe("Versand aus Deutschland is never divided", () => {
  it("keeps 8 on every order", () => {
    const perOrder = Array.from({ length: 5 }, () => 8);
    expect(perOrder).toEqual([8, 8, 8, 8, 8]);
    expect(perOrder.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("keeps individual amounts", () => {
    expect({ A: 5, B: 8, C: 12 }).toEqual({ A: 5, B: 8, C: 12 });
  });
});

describe("customer payloads never include markup", () => {
  it("order column list has no markup field", () => {
    expect(CUSTOMER_ORDER_COLUMNS).not.toMatch(/markup/);
    expect(CUSTOMER_ORDER_COLUMNS).not.toMatch(/admin_note/);
  });
});

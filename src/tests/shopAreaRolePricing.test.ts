import { describe, expect, it } from "vitest";

import { applySellFactorPct } from "@/lib/money";
import {
  applyAreaRoleSellUnit,
  roleMarkupPercentToSellFactorPct,
  sellFactorPctToRoleMarkupPercent,
} from "@/lib/shop/shopAreaRolePricing";

describe("applySellFactorPct", () => {
  it("applies unified sell factor semantics on catalog unit", () => {
    expect(applySellFactorPct(100, 100)).toBe(100);
    expect(applySellFactorPct(100, 110)).toBe(110);
    expect(applySellFactorPct(100, 125)).toBe(125);
    expect(applySellFactorPct(100, 200)).toBe(200);
    expect(applySellFactorPct(100, 300)).toBe(300);
  });
});

describe("applyAreaRoleSellUnit", () => {
  const catalog = 100;

  it("100 % explicit role → 100 USD (overrides global 200 %)", () => {
    expect(applyAreaRoleSellUnit(catalog, 100, 200)).toBe(100);
  });

  it("125 % explicit role → 125 USD", () => {
    expect(applyAreaRoleSellUnit(catalog, 125, 200)).toBe(125);
  });

  it("110 % explicit role → 110 USD (overrides global 135 %)", () => {
    expect(applyAreaRoleSellUnit(catalog, 110, 135)).toBe(110);
  });

  it("no explicit rule → global sell factor 200 % → 200 USD", () => {
    expect(applyAreaRoleSellUnit(catalog, null, 200)).toBe(200);
  });

  it("no explicit rule → global sell factor 125 % → 125 USD", () => {
    expect(applyAreaRoleSellUnit(catalog, null, 125)).toBe(125);
  });

  it("does not stack explicit factor with global factor", () => {
    expect(applyAreaRoleSellUnit(catalog, 125, 200)).toBe(125);
    expect(applyAreaRoleSellUnit(catalog, 125, 200)).not.toBe(156.25);
    expect(applyAreaRoleSellUnit(catalog, 125, 200)).not.toBe(250);
  });

  it("area base + role factor: 120 catalog × 125 % role → 150 USD", () => {
    expect(applyAreaRoleSellUnit(120, 125, 200)).toBe(150);
  });
});

describe("sell factor ↔ markup conversion (SQL twin)", () => {
  it("maps sell factor to additive markup for apply_role_markup pipeline", () => {
    expect(sellFactorPctToRoleMarkupPercent(100)).toBe(0);
    expect(sellFactorPctToRoleMarkupPercent(125)).toBe(25);
    expect(sellFactorPctToRoleMarkupPercent(200)).toBe(100);
    expect(sellFactorPctToRoleMarkupPercent(300)).toBe(200);
  });

  it("maps legacy additive markup to sell factor for one-time migration display", () => {
    expect(roleMarkupPercentToSellFactorPct(0)).toBe(100);
    expect(roleMarkupPercentToSellFactorPct(35)).toBe(135);
    expect(roleMarkupPercentToSellFactorPct(200)).toBe(300);
  });
});

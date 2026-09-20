import { describe, expect, it } from "vitest";

import {
  applyAreaRoleSellUnit,
  roleMarkupPercentToSellFactorPct,
  sellFactorPctToRoleMarkupPercent,
} from "@/lib/shop/shopAreaRolePricing";

describe("applyAreaRoleSellUnit", () => {
  const catalog = 100;

  it("100 % explicit role → 100 USD (not global fallback)", () => {
    expect(applyAreaRoleSellUnit(catalog, 100, 25)).toBe(100);
  });

  it("125 % explicit role → 125 USD", () => {
    expect(applyAreaRoleSellUnit(catalog, 125, 25)).toBe(125);
  });

  it("110 % explicit role → 110 USD", () => {
    expect(applyAreaRoleSellUnit(catalog, 110, 25)).toBe(110);
  });

  it("no explicit rule → global role markup (25 % → 125 USD)", () => {
    expect(applyAreaRoleSellUnit(catalog, null, 25)).toBe(125);
  });

  it("does not stack explicit factor with global markup", () => {
    expect(applyAreaRoleSellUnit(catalog, 125, 25)).toBe(125);
    expect(applyAreaRoleSellUnit(catalog, 125, 25)).not.toBe(156.25);
  });
});

describe("sell factor ↔ markup conversion", () => {
  it("maps 125 % sell factor to 25 % additive markup", () => {
    expect(sellFactorPctToRoleMarkupPercent(125)).toBe(25);
    expect(sellFactorPctToRoleMarkupPercent(100)).toBe(0);
  });

  it("maps global 25 % markup to 125 % sell factor display", () => {
    expect(roleMarkupPercentToSellFactorPct(25)).toBe(125);
    expect(roleMarkupPercentToSellFactorPct(0)).toBe(100);
  });
});

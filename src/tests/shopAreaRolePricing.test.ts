import { describe, expect, it } from "vitest";

import {
  applyAreaRoleSellUnit,
  roleMarkupPercentToSellFactorPct,
  sellFactorPctToRoleMarkupPercent,
} from "@/lib/shop/shopAreaRolePricing";

describe("applyAreaRoleSellUnit", () => {
  const catalog = 100;

  it("100 % leaves catalog unchanged", () => {
    expect(applyAreaRoleSellUnit(catalog, 100)).toBe(100);
  });

  it("125 % applies ×1.25 on catalog", () => {
    expect(applyAreaRoleSellUnit(catalog, 125)).toBe(125);
  });

  it("200 % doubles catalog", () => {
    expect(applyAreaRoleSellUnit(catalog, 200)).toBe(200);
  });

  it("chains with area catalog base (120 × 125 % = 150)", () => {
    expect(applyAreaRoleSellUnit(120, 125)).toBe(150);
  });
});

describe("sell factor conversion helpers", () => {
  it("maps sell factor to additive markup for apply_role_markup", () => {
    expect(sellFactorPctToRoleMarkupPercent(100)).toBe(0);
    expect(sellFactorPctToRoleMarkupPercent(125)).toBe(25);
    expect(sellFactorPctToRoleMarkupPercent(200)).toBe(100);
  });

  it("maps legacy additive markup to sell factor", () => {
    expect(roleMarkupPercentToSellFactorPct(0)).toBe(100);
    expect(roleMarkupPercentToSellFactorPct(35)).toBe(135);
    expect(roleMarkupPercentToSellFactorPct(200)).toBe(300);
  });
});

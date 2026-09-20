import { applySellFactorPct, roundHalfUp } from "@/lib/money";

/**
 * Area role sell factor on the area catalog unit (100 = pass-through, 125 = 1.25×).
 * Mirrors SQL shop_area_role_sell_factors via markup_percent_for_area + apply_role_markup.
 */
export function applyAreaRoleSellUnit(catalogUnitUsd: number, sellFactorPct: number): number {
  return applySellFactorPct(catalogUnitUsd, sellFactorPct);
}

/** Convert stored sell factor to additive markup for apply_role_markup (SQL twin). */
export function sellFactorPctToRoleMarkupPercent(sellFactorPct: number): number {
  return (sellFactorPct / 100 - 1) * 100;
}

/** Legacy additive markup → sell factor (migration / display helpers only). */
export function roleMarkupPercentToSellFactorPct(additiveMarkupPercent: number): number {
  return roundHalfUp((1 + additiveMarkupPercent / 100) * 100, 2);
}

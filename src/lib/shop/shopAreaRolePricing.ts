import { applyRoleMarkup, roundHalfUp } from "@/lib/money";

/**
 * Area role sell factor as shown in admin UI (100 = pass-through, 125 = 1.25× catalog).
 * Mirrors SQL: explicit row in shop_area_role_sell_factors.
 */
export function applyAreaRoleSellUnit(
  catalogUnitUsd: number,
  explicitSellFactorPct: number | null | undefined,
  globalRoleMarkupPercent: number,
): number {
  if (explicitSellFactorPct != null && Number.isFinite(explicitSellFactorPct)) {
    return roundHalfUp(catalogUnitUsd * (explicitSellFactorPct / 100), 4);
  }
  return applyRoleMarkup(catalogUnitUsd, globalRoleMarkupPercent);
}

/** Convert stored sell factor to additive markup for apply_role_markup (SQL twin). */
export function sellFactorPctToRoleMarkupPercent(sellFactorPct: number): number {
  return (sellFactorPct / 100 - 1) * 100;
}

/** Display helper: global role markup 25 → effective sell factor 125 on catalog. */
export function roleMarkupPercentToSellFactorPct(markupPercent: number): number {
  return roundHalfUp((1 + markupPercent / 100) * 100, 2);
}

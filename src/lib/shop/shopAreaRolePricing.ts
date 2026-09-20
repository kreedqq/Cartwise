import { applySellFactorPct, roundHalfUp } from "@/lib/money";

/**
 * Area role sell factor as shown in admin UI (100 = pass-through, 125 = 1.25× catalog).
 * Mirrors SQL: explicit row in shop_area_role_sell_factors, else global customer_roles.markup_percent (sell factor).
 */
export function applyAreaRoleSellUnit(
  catalogUnitUsd: number,
  explicitSellFactorPct: number | null | undefined,
  globalSellFactorPct: number,
): number {
  const factor =
    explicitSellFactorPct != null && Number.isFinite(explicitSellFactorPct)
      ? explicitSellFactorPct
      : globalSellFactorPct;
  return applySellFactorPct(catalogUnitUsd, factor);
}

/** Convert stored sell factor to additive markup for apply_role_markup (SQL twin). */
export function sellFactorPctToRoleMarkupPercent(sellFactorPct: number): number {
  return (sellFactorPct / 100 - 1) * 100;
}

/** Legacy additive markup → sell factor (migration / display helpers only). */
export function roleMarkupPercentToSellFactorPct(additiveMarkupPercent: number): number {
  return roundHalfUp((1 + additiveMarkupPercent / 100) * 100, 2);
}

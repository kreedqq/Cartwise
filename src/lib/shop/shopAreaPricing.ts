import { applyRoleMarkup, getEffectiveUnitPrice, type PricedProduct } from "@/lib/money";
import { RETAIL_KIT_UNIT_DIVISOR, type ShopPricingProfile } from "@/lib/shop/shopAreas";

export interface ShopAreaPricedProduct extends PricedProduct {
  category?: string | null;
  name?: string | null;
  code?: string | null;
}

/**
 * Catalog unit (0% markup) for a shop area. Role markup is applied exactly once
 * afterwards via applyRoleMarkup / SQL apply_role_markup.
 *
 * retail peptides/water: (kit_price / kitDivisor) × (factorPct / 100)
 * retail oils/orals:     getEffectiveUnitPrice × (factorPct / 100)
 * group_buy:             getEffectiveUnitPrice × (factorPct / 100)
 *
 * @param factorPct  Price multiplier expressed as a percentage.
 *                   100 = 1× (pass-through), 300 = 3×, 150 = 1.5×.
 *                   Default 100 (neutral). Pass `area.base_price_factor_pct` from the loaded area.
 */
export function shopAreaCatalogUnit(
  product: ShopAreaPricedProduct,
  quantity: number,
  profile: ShopPricingProfile,
  usesKitUnitPricing: boolean,
  factorPct = 100,
  kitDivisor = RETAIL_KIT_UNIT_DIVISOR,
): number {
  const factor = factorPct / 100;
  if (profile === "group_buy") {
    return getEffectiveUnitPrice(product, quantity).unitPriceUsd * factor;
  }
  if (usesKitUnitPricing) {
    return (product.price_usd / kitDivisor) * factor;
  }
  return getEffectiveUnitPrice(product, quantity).unitPriceUsd * factor;
}

export function shopAreaSellUnitPrice(
  product: ShopAreaPricedProduct,
  quantity: number,
  markupPercent: number,
  profile: ShopPricingProfile,
  usesKitUnitPricing: boolean,
  factorPct = 100,
  kitDivisor = RETAIL_KIT_UNIT_DIVISOR,
): number {
  return applyRoleMarkup(
    shopAreaCatalogUnit(product, quantity, profile, usesKitUnitPricing, factorPct, kitDivisor),
    markupPercent,
  );
}

/** Missing area override inherits the central catalog price. */
export function resolveAreaCatalogPriceUsd(
  globalPriceUsd: number,
  areaOverrideUsd: number | null | undefined,
): number {
  return areaOverrideUsd ?? globalPriceUsd;
}

/** Missing product×area×role markup inherits customer_roles.markup_percent (e.g. 25%). */
export function resolveAreaRoleMarkupPercent(
  roleMarkupPercent: number,
  areaProductRoleMarkup: number | null | undefined,
): number {
  return areaProductRoleMarkup ?? roleMarkupPercent;
}

/**
 * Final selling unit for one product in one area for one role.
 * Catalog override (optional) → area formula → applyRoleMarkup once.
 *
 * @param factorPct  Price multiplier as a percentage (100 = 1×, 300 = 3×).
 *                   Must be the last parameter to preserve backwards-compatible optional args.
 */
export function shopAreaSellUnitPriceForProductRole(
  globalProduct: ShopAreaPricedProduct,
  quantity: number,
  roleMarkupPercent: number,
  profile: ShopPricingProfile,
  usesKitUnitPricing: boolean,
  areaPriceOverrideUsd?: number | null,
  areaRoleMarkupPercent?: number | null,
  factorPct = 100,
): number {
  const catalog = {
    ...globalProduct,
    price_usd: resolveAreaCatalogPriceUsd(globalProduct.price_usd, areaPriceOverrideUsd),
  };
  return shopAreaSellUnitPrice(
    catalog,
    quantity,
    resolveAreaRoleMarkupPercent(roleMarkupPercent, areaRoleMarkupPercent),
    profile,
    usesKitUnitPricing,
    factorPct,
  );
}

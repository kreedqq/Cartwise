import { applyRoleMarkup, getEffectiveUnitPrice, type PricedProduct } from "@/lib/money";
import { RETAIL_KIT_UNIT_DIVISOR, RETAIL_PRICE_FACTOR, type ShopPricingProfile } from "@/lib/shop/shopAreas";

export interface ShopAreaPricedProduct extends PricedProduct {
  category?: string | null;
  name?: string | null;
  code?: string | null;
}

/**
 * Catalog unit (0% markup) for a shop area. Role markup is applied exactly once
 * afterwards via applyRoleMarkup / SQL apply_role_markup.
 *
 * retail peptides/water: kit_price / 10 × 5
 * retail oils/orals: existing quantity-tier unit × 5
 * group_buy: existing getEffectiveUnitPrice
 */
export function shopAreaCatalogUnit(
  product: ShopAreaPricedProduct,
  quantity: number,
  profile: ShopPricingProfile,
  usesKitUnitPricing: boolean,
  factor = RETAIL_PRICE_FACTOR,
  kitDivisor = RETAIL_KIT_UNIT_DIVISOR,
): number {
  if (profile === "group_buy") {
    return getEffectiveUnitPrice(product, quantity).unitPriceUsd;
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
  factor = RETAIL_PRICE_FACTOR,
  kitDivisor = RETAIL_KIT_UNIT_DIVISOR,
): number {
  return applyRoleMarkup(
    shopAreaCatalogUnit(product, quantity, profile, usesKitUnitPricing, factor, kitDivisor),
    markupPercent,
  );
}

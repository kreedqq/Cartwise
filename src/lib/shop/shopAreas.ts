export const SHOP_AREA_KEYS = ["shop", "group_buy_1", "group_buy_2"] as const;
export type ShopAreaKey = (typeof SHOP_AREA_KEYS)[number];

export const GROUP_BUY_AREA_KEYS = ["group_buy_1", "group_buy_2"] as const;
export type GroupBuyAreaKey = (typeof GROUP_BUY_AREA_KEYS)[number];

export const SHOP_PRICING_PROFILES = ["retail", "group_buy"] as const;
export type ShopPricingProfile = (typeof SHOP_PRICING_PROFILES)[number];

/** Central retail conversion. SQL `shop_areas.retail_price_factor` / `kit_unit_divisor` must stay in sync. */
export const RETAIL_PRICE_FACTOR = 5;
export const RETAIL_KIT_UNIT_DIVISOR = 10;

export const DEFAULT_SHOP_AREA: ShopAreaKey = "shop";

export const SHOP_AREA_PATHS: Record<ShopAreaKey, string> = {
  shop: "/shop/retail",  // Hub is now /shop
  group_buy_1: "/shop/group-buy-1",
  group_buy_2: "/shop/group-buy-2",
};

export const SHOP_AREA_LABELS: Record<ShopAreaKey, string> = {
  shop: "Shop",
  group_buy_1: "Group Buy 1",
  group_buy_2: "Group Buy 2",
};

export function isShopAreaKey(value: string | null | undefined): value is ShopAreaKey {
  return Boolean(value && (SHOP_AREA_KEYS as readonly string[]).includes(value));
}

export function isGroupBuyAreaKey(value: string | null | undefined): value is GroupBuyAreaKey {
  return Boolean(value && (GROUP_BUY_AREA_KEYS as readonly string[]).includes(value));
}

export function shopAreaFromPath(pathname: string): ShopAreaKey {
  if (pathname.startsWith("/shop/group-buy-2")) return "group_buy_2";
  if (pathname.startsWith("/shop/group-buy-1")) return "group_buy_1";
  return "shop";
}

export function shopAreaPath(key: ShopAreaKey): string {
  return SHOP_AREA_PATHS[key];
}

export interface MyShopArea {
  key: ShopAreaKey;
  name: string;
  pricing_profile: ShopPricingProfile;
  sort_order: number;
  path: string;
}

export function isRetailPricing(profile: ShopPricingProfile | null | undefined): boolean {
  return profile === "retail";
}

export function formatShopAreaLabel(key: string | null | undefined): string {
  if (!key) return "Nicht angegeben";
  if (isShopAreaKey(key)) return SHOP_AREA_LABELS[key];
  return key;
}

export const SHOP_AREA_SHORT_LABELS: Record<ShopAreaKey, string> = {
  shop: "Shop",
  group_buy_1: "GB 1",
  group_buy_2: "GB 2",
};

/** Cart/order quantity nouns from the stored area snapshot. Null = legacy kit catalog. */
export function saleModeForShopArea(area: string | null | undefined): "catalog" | "retail_unit" {
  return area === "shop" ? "retail_unit" : "catalog";
}

export function isGroupBuyPricing(profile: ShopPricingProfile | null | undefined): boolean {
  return profile === "group_buy";
}

/** Shop stays retail; both Group Buy areas keep the existing kit pricing profile. */
export function pricingProfileForArea(key: ShopAreaKey): ShopPricingProfile {
  return key === "shop" ? "retail" : "group_buy";
}

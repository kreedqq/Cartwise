export const SYSTEM_SHOP_AREA_KEYS = ["shop", "group_buy_1", "group_buy_2"] as const;
/** @deprecated Use SYSTEM_SHOP_AREA_KEYS. Kept so existing tests and filters still compile. */
export const SHOP_AREA_KEYS = SYSTEM_SHOP_AREA_KEYS;
export type SystemShopAreaKey = (typeof SYSTEM_SHOP_AREA_KEYS)[number];
export type ShopAreaKey = string;

export const GROUP_BUY_AREA_KEYS = ["group_buy_1", "group_buy_2"] as const;
export type GroupBuyAreaKey = (typeof GROUP_BUY_AREA_KEYS)[number];

export const SHOP_PRICING_PROFILES = ["retail", "group_buy"] as const;
export type ShopPricingProfile = (typeof SHOP_PRICING_PROFILES)[number];

export const SHOP_AREA_STATUSES = ["active", "disabled", "coming_soon", "closed"] as const;
export type ShopAreaStatus = (typeof SHOP_AREA_STATUSES)[number];

/**
 * Legacy retail multiplier (direct ×). Kept for tests and historical reference.
 * The active pricing pipeline uses `base_price_factor_pct` (percentage) instead.
 * SQL `shop_areas.retail_price_factor` is retained but no longer used in production pricing.
 */
export const RETAIL_PRICE_FACTOR = 5;
export const RETAIL_KIT_UNIT_DIVISOR = 10;

/**
 * Default base price factor (percentage) when no area value is available.
 * 100 % = 1× (pass-through). The active production value per area is stored in
 * `shop_areas.base_price_factor_pct` (e.g. 300 for the retail shop area).
 */
export const DEFAULT_BASE_PRICE_FACTOR_PCT = 100;

export const DEFAULT_SHOP_AREA: ShopAreaKey = "shop";

export const SHOP_AREA_PATHS: Record<SystemShopAreaKey, string> = {
  shop: "/shop/retail",
  group_buy_1: "/shop/group-buy-1",
  group_buy_2: "/shop/group-buy-2",
};

export const SHOP_AREA_LABELS: Record<SystemShopAreaKey, string> = {
  shop: "Shop",
  group_buy_1: "Group Buy 1",
  group_buy_2: "Group Buy 2",
};

export const SHOP_AREA_SHORT_LABELS: Record<SystemShopAreaKey, string> = {
  shop: "Shop",
  group_buy_1: "GB 1",
  group_buy_2: "GB 2",
};

const AREA_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export function isShopAreaKey(value: string | null | undefined): value is ShopAreaKey {
  return Boolean(value && AREA_KEY_PATTERN.test(value));
}

export function isSystemShopAreaKey(value: string | null | undefined): value is SystemShopAreaKey {
  return Boolean(value && (SYSTEM_SHOP_AREA_KEYS as readonly string[]).includes(value));
}

export function isGroupBuyAreaKey(value: string | null | undefined): value is GroupBuyAreaKey {
  return Boolean(value && (GROUP_BUY_AREA_KEYS as readonly string[]).includes(value));
}

export function shopAreaPathFromSlug(slug: string): string {
  return `/shop/${slug}`;
}

export function shopAreaFromPath(pathname: string): ShopAreaKey {
  const match = pathname.match(/^\/shop\/([^/]+)/);
  if (!match) return DEFAULT_SHOP_AREA;
  const slug = match[1];
  if (slug === "retail") return "shop";
  if (slug === "group-buy-1") return "group_buy_1";
  if (slug === "group-buy-2") return "group_buy_2";
  return slug.replace(/-/g, "_");
}

export function shopAreaPath(key: ShopAreaKey, slug?: string): string {
  if (slug) return shopAreaPathFromSlug(slug);
  if (isSystemShopAreaKey(key)) return SHOP_AREA_PATHS[key];
  return shopAreaPathFromSlug(key.replace(/_/g, "-"));
}

export interface MyShopArea {
  key: ShopAreaKey;
  slug?: string;
  name: string;
  short_name?: string;
  subtitle?: string | null;
  description?: string | null;
  icon_key?: string;
  badge_text?: string | null;
  badge_color?: string | null;
  status?: ShopAreaStatus;
  pricing_profile: ShopPricingProfile;
  sort_order: number;
  path: string;
  /** Price multiplier as a percentage (100 = 1×, 300 = 3×). Loaded from `shop_areas.base_price_factor_pct`. */
  base_price_factor_pct: number;
  theme?: Record<string, unknown>;
  options?: Record<string, unknown>;
  purchasable?: boolean;
}

export function isRetailPricing(profile: ShopPricingProfile | null | undefined): boolean {
  return profile === "retail";
}

export function isGroupBuyPricing(profile: ShopPricingProfile | null | undefined): boolean {
  return profile === "group_buy";
}

export function formatShopAreaLabel(key: string | null | undefined): string {
  if (!key) return "Nicht angegeben";
  if (isSystemShopAreaKey(key)) return SHOP_AREA_LABELS[key];
  return key;
}

/** Cart/order quantity nouns from the stored area snapshot. Null = legacy kit catalog. */
export function saleModeForShopArea(
  area: string | null | undefined,
  profile?: ShopPricingProfile | null,
): "catalog" | "retail_unit" {
  if (profile) return profile === "retail" ? "retail_unit" : "catalog";
  return area === "shop" ? "retail_unit" : "catalog";
}

/**
 * Legacy helper for the three original keys. New areas must read
 * `shop_areas.pricing_profile` from the database instead of inferring from the key.
 */
export function pricingProfileForArea(key: ShopAreaKey): ShopPricingProfile {
  return key === "shop" ? "retail" : "group_buy";
}

export function slugifyShopAreaName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "bereich";
}

import * as React from "react";
import type { CSSProperties } from "react";

import { DEFAULT_SHOP_AREA, type ShopAreaKey, type ShopPricingProfile } from "@/lib/shop/shopAreas";
import {
  AREA_THEME_BUTTON_CLASS,
  areaButtonRadiusCss,
  areaThemeCssVars,
  EMPTY_AREA_THEME,
  type AreaThemeConfig,
} from "@/lib/shop/areaTheme";
import { portalAssetById, type CategoryPortalOverride, type VialMediaConfig } from "@/lib/shop/portalAssets";
import {
  EMPTY_AREA_PORTAL,
  portalThemeCssVars,
  resolvePortalAccent,
  type AreaPortalConfig,
} from "@/lib/shop/portalTheme";

interface ShopAreaContextValue {
  shopArea: ShopAreaKey;
  pricingProfile: ShopPricingProfile;
  theme: AreaThemeConfig;
  portal: AreaPortalConfig;
  portalAccentHex: string;
  categoryPortals: Record<string, CategoryPortalOverride>;
  vialMedia: VialMediaConfig;
}

const emptyCategoryPortals: Record<string, CategoryPortalOverride> = {};
const emptyVialMedia: VialMediaConfig = { areaImage: "", categoryImages: {} };

const ShopAreaContext = React.createContext<ShopAreaContextValue>({
  shopArea: DEFAULT_SHOP_AREA,
  pricingProfile: "retail",
  theme: EMPTY_AREA_THEME,
  portal: EMPTY_AREA_PORTAL,
  portalAccentHex: "#c9a227",
  categoryPortals: emptyCategoryPortals,
  vialMedia: emptyVialMedia,
});

export function ShopAreaProvider({
  shopArea,
  pricingProfile,
  theme = EMPTY_AREA_THEME,
  portal = EMPTY_AREA_PORTAL,
  categoryPortals = emptyCategoryPortals,
  vialMedia = emptyVialMedia,
  children,
}: {
  shopArea: ShopAreaKey;
  pricingProfile: ShopPricingProfile;
  theme?: AreaThemeConfig;
  portal?: AreaPortalConfig;
  categoryPortals?: Record<string, CategoryPortalOverride>;
  vialMedia?: VialMediaConfig;
  children: React.ReactNode;
}) {
  const assetAccent = portalAssetById(portal.assetId)?.accentHex;
  const portalForAccent =
    assetAccent && !portal.accent ? { ...portal, accent: assetAccent } : portal;
  const portalAccentHex = resolvePortalAccent(
    portalForAccent,
    theme.tokens.accent,
    theme.tokens.primary,
    shopArea,
  );
  const value = React.useMemo(
    () => ({ shopArea, pricingProfile, theme, portal, portalAccentHex, categoryPortals, vialMedia }),
    [shopArea, pricingProfile, theme, portal, portalAccentHex, categoryPortals, vialMedia],
  );
  return (
    <ShopAreaContext.Provider value={value}>
      <div
        data-shop-area={shopArea}
        className={AREA_THEME_BUTTON_CLASS}
        style={{
          ...areaThemeCssVars(theme),
          ...portalThemeCssVars(portalAccentHex, portal.glow),
          "--area-button-radius": areaButtonRadiusCss(theme.buttons.radius),
        } as CSSProperties}
      >
        {children}
      </div>
    </ShopAreaContext.Provider>
  );
}

export function useShopAreaContext() {
  return React.useContext(ShopAreaContext);
}

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
}

const ShopAreaContext = React.createContext<ShopAreaContextValue>({
  shopArea: DEFAULT_SHOP_AREA,
  pricingProfile: "retail",
  theme: EMPTY_AREA_THEME,
  portal: EMPTY_AREA_PORTAL,
  portalAccentHex: "#c9a227",
});

export function ShopAreaProvider({
  shopArea,
  pricingProfile,
  theme = EMPTY_AREA_THEME,
  portal = EMPTY_AREA_PORTAL,
  children,
}: {
  shopArea: ShopAreaKey;
  pricingProfile: ShopPricingProfile;
  theme?: AreaThemeConfig;
  portal?: AreaPortalConfig;
  children: React.ReactNode;
}) {
  const portalAccentHex = resolvePortalAccent(portal, theme.tokens.accent, theme.tokens.primary, shopArea);
  const value = React.useMemo(
    () => ({ shopArea, pricingProfile, theme, portal, portalAccentHex }),
    [shopArea, pricingProfile, theme, portal, portalAccentHex],
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

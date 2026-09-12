import * as React from "react";

import { DEFAULT_SHOP_AREA, type ShopAreaKey, type ShopPricingProfile } from "@/lib/shop/shopAreas";
import { areaThemeCssVars, EMPTY_AREA_THEME, type AreaThemeConfig } from "@/lib/shop/areaTheme";

interface ShopAreaContextValue {
  shopArea: ShopAreaKey;
  pricingProfile: ShopPricingProfile;
  theme: AreaThemeConfig;
}

const ShopAreaContext = React.createContext<ShopAreaContextValue>({
  shopArea: DEFAULT_SHOP_AREA,
  pricingProfile: "retail",
  theme: EMPTY_AREA_THEME,
});

export function ShopAreaProvider({
  shopArea,
  pricingProfile,
  theme = EMPTY_AREA_THEME,
  children,
}: {
  shopArea: ShopAreaKey;
  pricingProfile: ShopPricingProfile;
  theme?: AreaThemeConfig;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ shopArea, pricingProfile, theme }),
    [shopArea, pricingProfile, theme],
  );
  return (
    <ShopAreaContext.Provider value={value}>
      <div data-shop-area={shopArea} style={areaThemeCssVars(theme)}>
        {children}
      </div>
    </ShopAreaContext.Provider>
  );
}

export function useShopAreaContext() {
  return React.useContext(ShopAreaContext);
}

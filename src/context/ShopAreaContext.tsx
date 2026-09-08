import * as React from "react";

import { DEFAULT_SHOP_AREA, type ShopAreaKey, type ShopPricingProfile } from "@/lib/shop/shopAreas";

interface ShopAreaContextValue {
  shopArea: ShopAreaKey;
  pricingProfile: ShopPricingProfile;
}

const ShopAreaContext = React.createContext<ShopAreaContextValue>({
  shopArea: DEFAULT_SHOP_AREA,
  pricingProfile: "retail",
});

export function ShopAreaProvider({
  shopArea,
  pricingProfile,
  children,
}: ShopAreaContextValue & { children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ shopArea, pricingProfile }),
    [shopArea, pricingProfile],
  );
  return <ShopAreaContext.Provider value={value}>{children}</ShopAreaContext.Provider>;
}

export function useShopAreaContext() {
  return React.useContext(ShopAreaContext);
}

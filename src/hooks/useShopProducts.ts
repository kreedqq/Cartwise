import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { DEFAULT_SHOP_AREA, type ShopAreaKey } from "@/lib/shop/shopAreas";
import { listShopProducts } from "@/services/products";
import { listShopProductsForArea } from "@/services/shopAreas";

/** Active products at the current user's selling prices for one shop area. */
export function useShopProducts(shopArea: ShopAreaKey = DEFAULT_SHOP_AREA) {
  return useQuery({
    queryKey: QUERY_KEYS.shopProducts(shopArea),
    queryFn: () => (shopArea === DEFAULT_SHOP_AREA ? listShopProducts() : listShopProductsForArea(shopArea)),
  });
}

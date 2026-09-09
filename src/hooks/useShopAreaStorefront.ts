import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import type { ShopAreaKey } from "@/lib/shop/shopAreas";
import { listShopAreaStorefront } from "@/services/shopAreas";

export function useShopAreaStorefront(shopArea: ShopAreaKey) {
  return useQuery({
    queryKey: QUERY_KEYS.shopAreaStorefront(shopArea),
    queryFn: () => listShopAreaStorefront(shopArea),
  });
}

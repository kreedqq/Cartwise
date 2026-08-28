import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { listShopProducts } from "@/services/products";

/** Active products at the current user's selling prices (server-applied markup). */
export function useShopProducts() {
  return useQuery({
    queryKey: QUERY_KEYS.shopProducts,
    queryFn: listShopProducts,
  });
}

import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { listMyShopAreas } from "@/services/shopAreas";

export function useMyShopAreas() {
  return useQuery({
    queryKey: QUERY_KEYS.myShopAreas,
    queryFn: listMyShopAreas,
  });
}

export function useFirstGroupBuyArea() {
  const areasQuery = useMyShopAreas();
  return {
    ...areasQuery,
    area: areasQuery.data?.find((area) => area.pricing_profile === "group_buy") ?? null,
  };
}

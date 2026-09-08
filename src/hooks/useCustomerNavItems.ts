import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { buildCustomerNavItems } from "@/lib/navigation";

export function useCustomerNavItems() {
  const areasQuery = useMyShopAreas();
  return {
    items: buildCustomerNavItems(areasQuery.data ?? []),
    isLoading: areasQuery.isLoading,
  };
}

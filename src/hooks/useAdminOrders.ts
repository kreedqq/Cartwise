import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { listAdminUserDirectory, listAllOrderItems, listAllOrders } from "@/services/orders";
import { listAdminKitOrderContext } from "@/services/kitOrderContext";

export function useAdminOrders() {
  return useQuery({ queryKey: QUERY_KEYS.adminOrders, queryFn: listAllOrders });
}

export function useAdminUserDirectory() {
  return useQuery({ queryKey: QUERY_KEYS.adminUserDirectory, queryFn: listAdminUserDirectory });
}

/** Small-catalog assumption (same as elsewhere in this app): fetch all order
 * lines once and filter/search client-side, rather than a server-side
 * full-text search endpoint that does not otherwise exist in this project. */
export function useAdminOrderItems() {
  return useQuery({ queryKey: QUERY_KEYS.adminOrderItems, queryFn: listAllOrderItems });
}

export function useAdminKitOrderContext() {
  return useQuery({ queryKey: QUERY_KEYS.adminKitOrderContext, queryFn: listAdminKitOrderContext });
}

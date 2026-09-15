import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { fetchKitShareCustomerLockMap } from "@/services/kitShareLockStatus";

export function useKitShareCustomerLockMap(kitShareIds: readonly string[]) {
  const sortedKey = [...new Set(kitShareIds.filter(Boolean))].sort().join(",");
  return useQuery({
    queryKey: [...QUERY_KEYS.kitShareCustomerLock, sortedKey],
    queryFn: () => fetchKitShareCustomerLockMap(kitShareIds),
    enabled: sortedKey.length > 0,
    staleTime: 30_000,
  });
}

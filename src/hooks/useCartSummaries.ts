import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { listCartSummaries } from "@/services/cartSummaries";

export function useCartSummaries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: QUERY_KEYS.cartSummaries(user?.id ?? ""),
    queryFn: listCartSummaries,
    enabled: Boolean(user?.id),
  });
}

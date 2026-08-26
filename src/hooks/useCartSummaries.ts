import { useQuery } from "@tanstack/react-query";

import { listCartSummaries } from "@/services/cartSummaries";

export function useCartSummaries() {
  return useQuery({
    queryKey: ["cart-summaries"],
    queryFn: listCartSummaries,
  });
}

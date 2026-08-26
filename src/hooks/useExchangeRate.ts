import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchExchangeRate } from "@/services/exchangeRate";
import { QUERY_KEYS } from "@/lib/constants";

export function useExchangeRate() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEYS.exchangeRate,
    queryFn: () => fetchExchangeRate(false),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  async function refresh() {
    const fresh = await fetchExchangeRate(true);
    queryClient.setQueryData(QUERY_KEYS.exchangeRate, fresh);
    return fresh;
  }

  return { ...query, refresh };
}

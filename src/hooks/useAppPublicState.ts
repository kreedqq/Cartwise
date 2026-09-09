import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { resolvePublicAccess } from "@/lib/siteAccess";
import { useAuth } from "@/context/AuthProvider";
import { getSiteAccessState } from "@/services/appSettings";

export function useAppPublicState() {
  return useQuery({
    queryKey: QUERY_KEYS.appPublicState,
    queryFn: getSiteAccessState,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useResolvedSiteAccess() {
  const { isAdmin, loading: authLoading } = useAuth();
  const siteQuery = useAppPublicState();
  const resolved = resolvePublicAccess({
    state: siteQuery.data ?? null,
    loadFailed: siteQuery.isError,
    isAdminConfirmed: isAdmin && !authLoading,
  });

  return {
    ...resolved,
    isLoading: authLoading || siteQuery.isLoading,
    isError: siteQuery.isError,
    refetch: siteQuery.refetch,
  };
}

export function useQuantityDiscountsEnabled(): boolean {
  const { quantityDiscountsEnabled, isLoading } = useResolvedSiteAccess();
  if (isLoading) return true;
  return quantityDiscountsEnabled;
}

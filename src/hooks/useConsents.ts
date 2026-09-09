import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { acceptResearchConsent, hasCurrentResearchConsent } from "@/services/consents";

export function useResearchConsent() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEYS.researchConsent(user?.id ?? "anon"),
    queryFn: hasCurrentResearchConsent,
    enabled: Boolean(user?.id),
  });
}

export function useAcceptResearchConsent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: acceptResearchConsent,
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.researchConsent(user.id) });
      }
    },
  });
}

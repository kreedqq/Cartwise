import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { createOrderTemplate, deleteOrderTemplate, listOrderTemplates } from "@/services/orderTemplates";

export function useOrderTemplates() {
  return useQuery({ queryKey: QUERY_KEYS.orderTemplates, queryFn: listOrderTemplates });
}

export function useOrderTemplateMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderTemplates });
  }

  const create = useMutation({
    mutationFn: ({ name, lines }: { name: string; lines: { productCode: string; quantity: number }[] }) => {
      if (!user) throw new Error("Nicht angemeldet.");
      return createOrderTemplate(user.id, name, lines);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOrderTemplate(id),
    onSuccess: invalidate,
  });

  return { create, remove };
}

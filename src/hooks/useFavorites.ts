import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { addFavorite, listFavorites, removeFavoriteByProductId } from "@/services/favorites";

export function useFavorites() {
  return useQuery({ queryKey: QUERY_KEYS.favorites, queryFn: listFavorites });
}

export function useFavoriteMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.favorites });
  }

  const add = useMutation({
    mutationFn: (productId: string) => {
      if (!user) throw new Error("Nicht angemeldet.");
      return addFavorite(user.id, productId);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (productId: string) => {
      if (!user) throw new Error("Nicht angemeldet.");
      return removeFavoriteByProductId(user.id, productId);
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}

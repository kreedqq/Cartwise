import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import {
  archiveCart,
  createCart,
  duplicateCart,
  listCarts,
  setActiveCart,
  softDeleteCart,
  updateCartNote,
  updateCartStatus,
} from "@/services/carts";
import type { CartStatus, Tables } from "@/types/database";

export function useCarts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: QUERY_KEYS.carts(user?.id ?? ""),
    queryFn: listCarts,
    enabled: Boolean(user?.id),
  });
}

export function useCartMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  function invalidate() {
    if (!user) return Promise.resolve();
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(user.id) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartSummaries(user.id) }),
    ]);
  }

  const create = useMutation({
    mutationFn: (input?: { note?: string }) => {
      if (!user) throw new Error("Nicht angemeldet.");
      return createCart(user.id, input?.note);
    },
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: ({ cart, note }: { cart: Tables<"carts">; note: string }) =>
      updateCartNote(cart.id, cart.version, note),
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: ({ cart, status }: { cart: Tables<"carts">; status: CartStatus }) =>
      updateCartStatus(cart.id, cart.version, status),
    onSuccess: invalidate,
  });

  const activate = useMutation({
    mutationFn: (cartId: string) => setActiveCart(cartId),
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: (cartId: string) => duplicateCart(cartId),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: (cart: Tables<"carts">) => archiveCart(cart.id, cart.version),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (cartId: string) => softDeleteCart(cartId),
    onSuccess: invalidate,
  });

  return { create, updateNote, updateStatus, activate, duplicate, archive, remove };
}

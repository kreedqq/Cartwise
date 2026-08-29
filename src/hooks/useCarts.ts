import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import {
  archiveCart,
  createCart,
  duplicateCart,
  listCarts,
  renameCart,
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
    return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(user.id) });
  }

  const create = useMutation({
    mutationFn: ({ name, note }: { name: string; note?: string }) => {
      if (!user) throw new Error("Nicht angemeldet.");
      return createCart(user.id, name, note);
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: ({ cart, name }: { cart: Tables<"carts">; name: string }) => renameCart(cart.id, cart.version, name),
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
    mutationFn: ({ cartId, newName }: { cartId: string; newName: string }) => duplicateCart(cartId, newName),
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

  return { create, rename, updateNote, updateStatus, activate, duplicate, archive, remove };
}

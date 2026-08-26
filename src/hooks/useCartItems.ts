import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  addCartItem,
  addCartItemsBulk,
  deleteCartItem,
  duplicateCartItem,
  listCartItems,
  mergeDuplicateCartItems,
  refreshCartItemPrice,
  reorderCartItems,
  reresolveCartItemCode,
  updateCartItemNote,
  updateCartItemQuantity,
} from "@/services/cartItems";
import type { Tables } from "@/types/database";

export function useCartItems(cartId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.cartItems(cartId ?? ""),
    queryFn: () => listCartItems(cartId as string),
    enabled: !!cartId,
  });
}

export function useCartItemMutations(cartId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartItems(cartId) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts }),
    ]);
  }

  const add = useMutation({
    mutationFn: ({
      productCode,
      quantity,
      nextPosition,
      rate,
    }: {
      productCode: string;
      quantity: number;
      nextPosition: number;
      rate: number | null;
    }) => addCartItem(cartId, productCode, quantity, nextPosition, rate),
    onSuccess: invalidate,
  });

  const updateCode = useMutation({
    mutationFn: ({ item, newCode, rate }: { item: Tables<"cart_items">; newCode: string; rate: number | null }) =>
      reresolveCartItemCode(item, newCode, rate),
    onSuccess: invalidate,
  });

  const updateQuantity = useMutation({
    mutationFn: ({ item, quantity }: { item: Tables<"cart_items">; quantity: number }) =>
      updateCartItemQuantity(item, quantity),
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: ({ item, note }: { item: Tables<"cart_items">; note: string }) => updateCartItemNote(item, note),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCartItem(id),
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: ({ item, nextPosition }: { item: Tables<"cart_items">; nextPosition: number }) =>
      duplicateCartItem(item, nextPosition),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (items: { id: string; position: number }[]) => reorderCartItems(items),
    onSuccess: invalidate,
  });

  const refreshPrice = useMutation({
    mutationFn: ({
      item,
      currentPriceUsd,
      currentRate,
    }: {
      item: Tables<"cart_items">;
      currentPriceUsd: number;
      currentRate: number | null;
    }) => refreshCartItemPrice(item, currentPriceUsd, currentRate),
    onSuccess: invalidate,
  });

  const addBulk = useMutation({
    mutationFn: ({
      lines,
      startPosition,
      rate,
    }: {
      lines: { code: string; quantity: number }[];
      startPosition: number;
      rate: number | null;
    }) => addCartItemsBulk(cartId, lines, startPosition, rate),
    onSuccess: invalidate,
  });

  const merge = useMutation({
    mutationFn: (items: Tables<"cart_items">[]) => mergeDuplicateCartItems(items),
    onSuccess: invalidate,
  });

  return { add, addBulk, updateCode, updateQuantity, updateNote, remove, duplicate, reorder, refreshPrice, merge };
}

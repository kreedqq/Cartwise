import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { useCarts, useCartMutations } from "@/hooks/useCarts";
import { addCartItem, addCartItemsBulk, type BulkImportLine } from "@/services/cartItems";
import { pickActiveOpenCart } from "@/services/carts";
import type { Tables } from "@/types/database";

/**
 * Resolves (creating + activating if necessary) the current user's active
 * cart, so the Shop / Quick-Order / Favorites / Reorder screens can add
 * items with a single click (sections 8/9/13/24/25) without first
 * navigating to a cart page.
 *
 * Deliberately bypasses useCartItemMutations here: that hook binds to a
 * cartId at render time, but the very first "add to cart" click on this
 * page may need to *create* the cart first - the freshly created id would
 * not be reflected in an already-rendered mutation hook until the next
 * render. Reading/writing the query cache directly avoids that race.
 */
export function useShopCart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cartsQuery = useCarts();
  const { create, activate } = useCartMutations();
  const [ensuring, setEnsuring] = React.useState(false);

  const activeCart = pickActiveOpenCart(cartsQuery.data, user?.id);

  async function ensureActiveCartId(): Promise<string> {
    if (activeCart) return activeCart.id;
    if (!user) throw new Error("Nicht angemeldet.");
    setEnsuring(true);
    try {
      const created = await create.mutateAsync({});
      await activate.mutateAsync(created.id);
      return created.id;
    } finally {
      setEnsuring(false);
    }
  }

  function nextPositionFor(cartId: string): number {
    const cached = queryClient.getQueryData<Tables<"cart_items">[]>(QUERY_KEYS.cartItems(cartId));
    if (!cached || cached.length === 0) return 0;
    return Math.max(...cached.map((i) => i.position)) + 1;
  }

  async function invalidateAfterAdd(cartId: string) {
    if (!user) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartItems(cartId) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(user.id) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartSummaries(user.id) }),
    ]);
  }

  async function addToActiveCart(
    productCode: string,
    quantity: number,
    rate: number | null,
  ): Promise<Tables<"cart_items">> {
    const cartId = await ensureActiveCartId();
    const item = await addCartItem(cartId, productCode, quantity, nextPositionFor(cartId), rate);
    await invalidateAfterAdd(cartId);
    return item;
  }

  async function addManyToActiveCart(
    lines: BulkImportLine[],
    rate: number | null,
  ): Promise<Tables<"cart_items">[]> {
    const cartId = await ensureActiveCartId();
    const items = await addCartItemsBulk(cartId, lines, nextPositionFor(cartId), rate);
    await invalidateAfterAdd(cartId);
    return items;
  }

  return {
    activeCart,
    cartsLoading: cartsQuery.isLoading,
    ensuring,
    addToActiveCart,
    addManyToActiveCart,
  };
}

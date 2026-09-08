import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { useCarts } from "@/hooks/useCarts";
import { DEFAULT_SHOP_AREA, type ShopAreaKey } from "@/lib/shop/shopAreas";
import { addCartItem, addCartItemsBulk, type BulkImportLine } from "@/services/cartItems";
import { pickActiveOpenCart } from "@/services/carts";
import { ensureShopAreaCart } from "@/services/shopAreas";
import type { Tables } from "@/types/database";

/**
 * Resolves the cart for a shop area (creating + activating if needed).
 * Shop add-to-cart always uses the area from ShopAreaProvider, not a mixed cart.
 */
export function useShopCart(shopArea?: ShopAreaKey) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cartsQuery = useCarts();
  const context = useShopAreaContext();
  const area = shopArea ?? context.shopArea ?? DEFAULT_SHOP_AREA;
  const [ensuring, setEnsuring] = React.useState(false);

  const activeCart = pickActiveOpenCart(cartsQuery.data, user?.id);
  const areaCart =
    cartsQuery.data?.find(
      (cart) =>
        cart.user_id === user?.id &&
        cart.shop_area === area &&
        !cart.deleted_at &&
        cart.status !== "ordered",
    ) ?? null;

  async function ensureActiveCartId(): Promise<string> {
    if (!user) throw new Error("Nicht angemeldet.");
    setEnsuring(true);
    try {
      const cart = await ensureShopAreaCart(area);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(user.id) }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartSummaries(user.id) }),
      ]);
      return cart.id;
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
    activeCart: areaCart ?? activeCart,
    cartsLoading: cartsQuery.isLoading,
    ensuring,
    addToActiveCart,
    addManyToActiveCart,
  };
}

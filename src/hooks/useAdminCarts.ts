import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  adminAddOpenCartCatalogLine,
  adminCheckoutOpenCart,
  adminDeleteCarts,
  adminRemoveOpenCartItem,
  adminReplaceOpenCartCatalogLine,
  adminSyncOrdersAndCarts,
  adminUpdateOpenCartItemQuantity,
  getAdminOpenCartDetail,
  listAdminOpenCarts,
} from "@/services/adminCarts";

export function useAdminOpenCarts(shopArea?: string | null, search?: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminOpenCarts({ shopArea, search }),
    queryFn: () => listAdminOpenCarts(shopArea, search),
  });
}

export function useAdminOpenCartDetail(cartId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminOpenCartDetail(cartId ?? ""),
    queryFn: () => getAdminOpenCartDetail(cartId!),
    enabled: Boolean(cartId),
  });
}

export function useAdminCartMutations(cartId: string) {
  const queryClient = useQueryClient();

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOpenCartDetail(cartId) });
    await queryClient.invalidateQueries({ queryKey: ["admin-open-carts"] });
  }

  const updateQuantity = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      adminUpdateOpenCartItemQuantity(itemId, quantity),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => adminRemoveOpenCartItem(itemId),
    onSuccess: invalidate,
  });

  const addCatalogLine = useMutation({
    mutationFn: (input: {
      shopArea: string;
      vendorCode: string;
      productId: string | null;
      quantity: number;
    }) =>
      adminAddOpenCartCatalogLine({
        cartId,
        shopArea: input.shopArea,
        vendorCode: input.vendorCode,
        productId: input.productId,
        quantity: input.quantity,
      }),
    onSuccess: invalidate,
  });

  const replaceCatalogLine = useMutation({
    mutationFn: (input: {
      itemId: string;
      shopArea: string;
      vendorCode: string;
      productId: string | null;
      quantity: number;
    }) =>
      adminReplaceOpenCartCatalogLine({
        cartItemId: input.itemId,
        shopArea: input.shopArea,
        vendorCode: input.vendorCode,
        productId: input.productId,
        quantity: input.quantity,
      }),
    onSuccess: invalidate,
  });

  const checkout = useMutation({
    mutationFn: (payload: Parameters<typeof adminCheckoutOpenCart>[1]) => adminCheckoutOpenCart(cartId, payload),
  });

  return { updateQuantity, removeItem, addCatalogLine, replaceCatalogLine, checkout };
}

export function useAdminGlobalSync() {
  return useMutation({
    mutationFn: () => adminSyncOrdersAndCarts(),
  });
}

export function useAdminDeleteOpenCarts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cartIds: string[]) => adminDeleteCarts(cartIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-open-carts"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-open-cart"] });
    },
  });
}

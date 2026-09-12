export interface CartItemIdentityInput {
  shop_area?: string | null;
  vendor_code?: string | null;
  product_id?: string | null;
  product_code_snapshot?: string | null;
  product_code_input?: string | null;
  kit_share_id?: string | null;
}

function catalogCode(item: CartItemIdentityInput): string {
  return (
    item.vendor_code?.trim() ||
    item.product_code_snapshot?.trim() ||
    item.product_code_input?.trim() ||
    item.product_id ||
    ""
  ).toUpperCase();
}

/** Same product in the same area, never kit shares. */
export function cartItemMergeKey(item: CartItemIdentityInput): string {
  if (item.kit_share_id) return `kit:${item.kit_share_id}`;
  return `${item.shop_area?.trim() || "shop"}|${catalogCode(item)}`;
}

export function canMergeCartItems(left: CartItemIdentityInput, right: CartItemIdentityInput): boolean {
  if (left.kit_share_id || right.kit_share_id) return false;
  return cartItemMergeKey(left) === cartItemMergeKey(right);
}

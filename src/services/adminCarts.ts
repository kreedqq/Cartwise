import { logSupabaseRpcError } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export interface AdminOpenCartRow {
  cart_id: string;
  user_id: string;
  username: string;
  cart_name: string;
  status: string;
  updated_at: string;
  item_count: number;
  total_usd: number;
  total_eur: number | null;
  shop_areas: string[];
  has_kit: boolean;
  has_submitted_lines: boolean;
}

export interface AdminOpenCartDetail {
  cart: Tables<"carts">;
  customer: { userId: string; username: string | null };
  summary: Record<string, unknown> | null;
  items: Array<Tables<"cart_items"> & { kit_status?: string | null; kit_size_vials?: number | null }>;
}

export interface AdminGlobalSyncResult {
  cartsChecked: number;
  cartItemsChanged: number;
  kitsChecked: number;
  kitsSynced: number;
  kitsAlreadySynchronized: number;
  ordersChecked: number;
  ordersExtended: number;
  ambiguous: number;
  historicalPriceMissing: number;
  errors: Array<{ kitShareId?: string; message: string }>;
}

export async function listAdminOpenCarts(
  shopArea?: string | null,
  search?: string | null,
): Promise<AdminOpenCartRow[]> {
  const { data, error } = await supabase.rpc("admin_list_open_carts", {
    _shop_area: shopArea ?? null,
    _search: search ?? null,
  });
  if (error) throw error;
  return (data ?? []) as AdminOpenCartRow[];
}

export async function getAdminOpenCartDetail(cartId: string): Promise<AdminOpenCartDetail> {
  const { data, error } = await supabase.rpc("admin_get_open_cart_detail", { _cart_id: cartId });
  if (error) throw error;
  return data as unknown as AdminOpenCartDetail;
}

export async function adminUpdateOpenCartItemQuantity(cartItemId: string, quantity: number): Promise<void> {
  const { error } = await supabase.rpc("admin_update_open_cart_item_quantity", {
    _cart_item_id: cartItemId,
    _quantity: quantity,
  });
  if (error) throw error;
}

export async function adminRemoveOpenCartItem(cartItemId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_remove_open_cart_item", { _cart_item_id: cartItemId });
  if (error) throw error;
}

export async function adminAddOpenCartCatalogLine(input: {
  cartId: string;
  shopArea: string;
  vendorCode: string;
  productId: string | null;
  quantity: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("admin_add_open_cart_catalog_line", {
    _cart_id: input.cartId,
    _shop_area: input.shopArea,
    _vendor_code: input.vendorCode,
    _product_id: input.productId,
    _quantity: input.quantity,
  });
  if (error) throw error;
  return data as string;
}

export async function adminReplaceOpenCartCatalogLine(input: {
  cartItemId: string;
  shopArea: string;
  vendorCode: string;
  productId: string | null;
  quantity: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("admin_replace_open_cart_catalog_line", {
    _cart_item_id: input.cartItemId,
    _shop_area: input.shopArea,
    _vendor_code: input.vendorCode,
    _product_id: input.productId,
    _quantity: input.quantity,
  });
  if (error) throw error;
  return data as string;
}

export async function adminCheckoutOpenCart(
  cartId: string,
  payload: {
    note: string | null;
    paymentMethod: string;
    shipping: {
      firstName: string;
      lastName: string;
      street: string | null;
      houseNumber: string | null;
      addressExtra: string | null;
      postalCode: string;
      city: string;
      country: string;
      deliveryMethod: string;
      packstationNumber: string | null;
      postNumber: string | null;
    };
  },
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("admin_checkout_open_cart", {
    _cart_id: cartId,
    _note: payload.note,
    _payment_method: payload.paymentMethod,
    _shipping_first_name: payload.shipping.firstName,
    _shipping_last_name: payload.shipping.lastName,
    _shipping_street: payload.shipping.street,
    _shipping_house_number: payload.shipping.houseNumber,
    _shipping_address_extra: payload.shipping.addressExtra,
    _shipping_postal_code: payload.shipping.postalCode,
    _shipping_city: payload.shipping.city,
    _shipping_country: payload.shipping.country,
    _shipping_delivery_method: payload.shipping.deliveryMethod,
    _shipping_packstation_number: payload.shipping.packstationNumber,
    _shipping_post_number: payload.shipping.postNumber,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function adminSyncOrdersAndCarts(): Promise<AdminGlobalSyncResult> {
  const { data, error } = await supabase.rpc("admin_sync_orders_and_carts");
  if (error) throw error;
  return data as unknown as AdminGlobalSyncResult;
}

export interface AdminDeleteCartsResult {
  deletedCount: number;
  cartIds: string[];
}

export async function adminDeleteCarts(cartIds: string[]): Promise<AdminDeleteCartsResult> {
  const { data, error } = await supabase.rpc("admin_delete_carts", { _cart_ids: cartIds });
  if (error) {
    logSupabaseRpcError("[admin_delete_carts]", error);
    throw error;
  }
  const payload = data as { deletedCount?: number; cartIds?: string[] };
  return {
    deletedCount: payload.deletedCount ?? cartIds.length,
    cartIds: payload.cartIds ?? cartIds,
  };
}

import { supabase } from "@/lib/supabaseClient";
import type { PaymentMethod } from "@/lib/shop/paymentMethod";
import type { ShippingAddress } from "@/lib/shippingAddress";
import type { OrderStatus, Tables } from "@/types/database";

export interface OrderWithItems extends Tables<"orders"> {
  items: Tables<"order_items">[];
}

export const CUSTOMER_ORDER_COLUMNS =
  "id, order_number, user_id, cart_id, status, note, payment_method, telegram_username_snapshot, shipping_delivery_method, shipping_first_name, shipping_last_name, shipping_street, shipping_house_number, shipping_address_extra, shipping_packstation_number, shipping_post_number, shipping_postal_code, shipping_city, shipping_country, total_usd, total_eur, exchange_rate, submitted_at, created_at, updated_at, china_shipping_amount, china_shipping_currency, de_shipping_amount, de_shipping_currency";

/** Customer: their own orders (RLS-scoped), most recent first. */
export async function listMyOrders(): Promise<Tables<"orders">[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(CUSTOMER_ORDER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tables<"orders">[];
}

export async function getOrder(id: string): Promise<Tables<"orders"> | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(CUSTOMER_ORDER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Tables<"orders"> | null;
}

export async function listOrderItems(orderId: string): Promise<Tables<"order_items">[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getOrderWithItems(id: string): Promise<OrderWithItems | null> {
  const [order, items] = await Promise.all([getOrder(id), listOrderItems(id)]);
  if (!order) return null;
  return { ...order, items };
}

export async function listOrderStatusHistory(orderId: string): Promise<Tables<"order_status_history">[]> {
  const { data, error } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  totalUsd: number;
}

/**
 * Transactionally submits a cart as an order via create_order() (see
 * supabase/migrations/0016_orders.sql). Never computes the total client-side
 * - the returned totalUsd is exactly what the server derived from the
 * frozen cart_items snapshots.
 */
export async function createOrder(
  cartId: string,
  note: string | null,
  paymentMethod: PaymentMethod,
  shipping: ShippingAddress,
): Promise<CreateOrderResult> {
  const payload =
    shipping.deliveryMethod === "home"
      ? {
          _cart_id: cartId,
          _note: note,
          _payment_method: paymentMethod,
          _shipping_delivery_method: shipping.deliveryMethod,
          _shipping_first_name: shipping.firstName,
          _shipping_last_name: shipping.lastName,
          _shipping_street: shipping.street,
          _shipping_house_number: shipping.houseNumber,
          _shipping_address_extra: shipping.addressExtra ?? null,
          _shipping_packstation_number: null,
          _shipping_post_number: null,
          _shipping_postal_code: shipping.postalCode,
          _shipping_city: shipping.city,
          _shipping_country: shipping.country,
        }
      : {
          _cart_id: cartId,
          _note: note,
          _payment_method: paymentMethod,
          _shipping_delivery_method: shipping.deliveryMethod,
          _shipping_first_name: shipping.firstName,
          _shipping_last_name: shipping.lastName,
          _shipping_street: null,
          _shipping_house_number: null,
          _shipping_address_extra: null,
          _shipping_packstation_number: shipping.packstationNumber,
          _shipping_post_number: shipping.postNumber,
          _shipping_postal_code: shipping.postalCode,
          _shipping_city: shipping.city,
          _shipping_country: shipping.country,
        };
  const { data, error } = await supabase.rpc("create_order", payload);
  if (error) throw error;
  return data as unknown as CreateOrderResult;
}

/** Admin-only: changes status and/or the internal admin note via set_order_status(). */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  adminNote?: string | null,
): Promise<Tables<"orders">> {
  const { data, error } = await supabase.rpc("set_order_status", {
    _order_id: orderId,
    _status: status,
    _admin_note: adminNote ?? null,
  });
  if (error) throw error;
  return data as unknown as Tables<"orders">;
}

/** Terminal states that an admin may permanently delete. Active orders stay. */
export function canPermanentlyDeleteOrder(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/** Admin-only: permanently deletes a completed or cancelled order via delete_order(). */
export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_order", { _order_id: orderId });
  if (error) throw error;
}

/** Admin-only: all orders regardless of owner. */
export async function listAllOrders(): Promise<Tables<"orders">[]> {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Admin-only: every order line across all orders, for article-code/name search. */
export async function listAllOrderItems(): Promise<Tables<"order_items">[]> {
  const { data, error } = await supabase.from("order_items").select("*");
  if (error) throw error;
  return data ?? [];
}

export interface AdminUserDirectoryEntry {
  id: string;
  email: string | null;
  displayName: string;
}

/**
 * Admin-only id -> {email, displayName} lookup (see the admin_user_directory
 * view - it returns zero rows for a non-admin caller regardless of query).
 */
export async function listAdminUserDirectory(): Promise<Map<string, AdminUserDirectoryEntry>> {
  const { data, error } = await supabase.from("admin_user_directory").select("*");
  if (error) throw error;
  const map = new Map<string, AdminUserDirectoryEntry>();
  for (const row of data ?? []) {
    map.set(row.id, { id: row.id, email: row.email, displayName: row.display_name });
  }
  return map;
}

export async function getOrderAdminNote(orderId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("order_admin_notes")
    .select("note")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data?.note ?? null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Eingegangen",
  processing: "In Bearbeitung",
  confirmed: "Bestätigt",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

/** Sensible next statuses from a given status (mirrors the DB guard in set_order_status). */
export function nextOrderStatuses(current: OrderStatus): OrderStatus[] {
  switch (current) {
    case "pending":
      return ["processing", "cancelled"];
    case "processing":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["completed", "cancelled"];
    default:
      return [];
  }
}

export function orderItemsToBulkLines(items: Tables<"order_items">[]): { code: string; quantity: number }[] {
  return items.map((item) => ({ code: item.product_code_snapshot, quantity: item.quantity }));
}

import { supabase } from "@/lib/supabaseClient";
import type { OrderStatus, Tables } from "@/types/database";

export interface OrderWithItems extends Tables<"orders"> {
  items: Tables<"order_items">[];
}

export const CUSTOMER_ORDER_COLUMNS =
  "id, order_number, user_id, cart_id, status, note, total_usd, total_eur, exchange_rate, submitted_at, created_at, updated_at, china_shipping_amount, china_shipping_currency, de_shipping_amount, de_shipping_currency";

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
export async function createOrder(cartId: string, note: string | null): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc("create_order", { _cart_id: cartId, _note: note });
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

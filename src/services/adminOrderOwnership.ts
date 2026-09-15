import { supabase } from "@/lib/supabaseClient";

export type AdminTransferOrdersResult = {
  fromUserId: string;
  toUserId: string;
  orderIds: string[];
  orderNumbers: string[];
  count: number;
};

export type AdminPreflightUserDelete = {
  userId: string;
  orderCount: number;
  openCartCount: number;
  kitParticipantCount: number;
  canDeleteViaAdminRpc: boolean;
  blockers: string[];
  note: string;
};

export async function adminTransferOrders(input: {
  fromUserId: string;
  toUserId: string;
  orderIds: string[];
  reason: string;
}): Promise<AdminTransferOrdersResult> {
  const { data, error } = await supabase.rpc("admin_transfer_orders", {
    _from_user_id: input.fromUserId,
    _to_user_id: input.toUserId,
    _order_ids: input.orderIds,
    _reason: input.reason.trim(),
  });
  if (error) throw error;
  return data as AdminTransferOrdersResult;
}

export async function adminPreflightUserDelete(userId: string): Promise<AdminPreflightUserDelete> {
  const { data, error } = await supabase.rpc("admin_preflight_user_delete", {
    _user_id: userId,
  });
  if (error) throw error;
  const raw = data as {
    userId: string;
    orderCount: number;
    openCartCount: number;
    kitParticipantCount: number;
    canDeleteViaAdminRpc: boolean;
    blockers: unknown;
    note: string;
  };
  const blockers = Array.isArray(raw.blockers)
    ? raw.blockers.map(String)
    : raw.blockers && typeof raw.blockers === "object"
      ? Object.values(raw.blockers as Record<string, string>).map(String)
      : [];
  return { ...raw, blockers };
}

export async function adminLinkCartItemSubmittedOrder(input: {
  cartItemId: string;
  reason: string;
}): Promise<{ cartItemId: string; submittedOrderId: string; kitShareId: string | null }> {
  const { data, error } = await supabase.rpc("admin_link_cart_item_submitted_order", {
    _cart_item_id: input.cartItemId,
    _reason: input.reason.trim(),
  });
  if (error) throw error;
  return data as { cartItemId: string; submittedOrderId: string; kitShareId: string | null };
}

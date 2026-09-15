import { supabase } from "@/lib/supabaseClient";
import {
  summarizeOrderIntegrity,
  type OrderIntegrityCartLine,
  type OrderIntegritySummary,
} from "@/lib/orderIntegrity";
import type { Tables } from "@/types/database";

export async function auditOrderCartIntegrity(input: {
  orderId: string;
  cartId: string | null;
  orderItems: Tables<"order_items">[];
}): Promise<OrderIntegritySummary | null> {
  if (!input.cartId) return null;

  const { data: cartItems, error } = await supabase
    .from("cart_items")
    .select(
      "product_code_snapshot, quantity, kit_share_id, submitted_order_id, eur_value_snapshot",
    )
    .eq("cart_id", input.cartId);
  if (error) throw error;

  const kitIds = [...new Set((cartItems ?? []).map((c) => c.kit_share_id).filter(Boolean))] as string[];
  const kitMeta = new Map<string, { status: string; allocated: number; size: number }>();

  if (kitIds.length > 0) {
    const { data: kits, error: kitErr } = await supabase
      .from("kit_shares")
      .select("id, status, kit_size_vials")
      .in("id", kitIds);
    if (kitErr) throw kitErr;

    for (const kit of kits ?? []) {
      const { data: parts, error: pErr } = await supabase
        .from("kit_share_participants")
        .select("quantity")
        .eq("kit_share_id", kit.id);
      if (pErr) throw pErr;
      const allocated = (parts ?? []).reduce((s, p) => s + Number(p.quantity), 0);
      kitMeta.set(kit.id, {
        status: kit.status,
        allocated,
        size: kit.kit_size_vials,
      });
    }
  }

  const cartLines: OrderIntegrityCartLine[] = (cartItems ?? []).map((ci) => {
    const meta = ci.kit_share_id ? kitMeta.get(ci.kit_share_id) : undefined;
    return {
      productCode: String(ci.product_code_snapshot ?? ""),
      quantity: Number(ci.quantity),
      kitShareId: ci.kit_share_id,
      submittedOrderId: ci.submitted_order_id,
      kitStatus: meta?.status ?? null,
      kitAllocated: meta?.allocated ?? null,
      kitSizeVials: meta?.size ?? null,
      eurValue: ci.eur_value_snapshot == null ? null : Number(ci.eur_value_snapshot),
    };
  });

  return summarizeOrderIntegrity({
    orderId: input.orderId,
    orderLines: input.orderItems.map((oi) => ({
      productCode: String(oi.product_code_snapshot ?? ""),
      quantity: Number(oi.quantity),
      lineTotalUsd: Number(oi.line_total_usd),
      kitShareIdSnapshot: oi.kit_share_id_snapshot,
    })),
    cartLines,
  });
}

import { supabase } from "@/lib/supabaseClient";
import type { ShippingCurrency, Tables } from "@/types/database";

export interface ChinaSplitPreview {
  shares: number[];
  total: number;
  count: number;
}

export async function previewChinaSplit(amount: number, orderIds: string[]): Promise<ChinaSplitPreview> {
  const { data, error } = await supabase.rpc("admin_preview_china_split", {
    _amount: amount,
    _order_ids: orderIds,
  });
  if (error) throw error;
  return data as ChinaSplitPreview;
}

export async function applyChinaSplit(
  amount: number,
  currency: ShippingCurrency,
  orderIds: string[],
): Promise<ChinaSplitPreview> {
  const { data, error } = await supabase.rpc("admin_apply_china_split", {
    _amount: amount,
    _currency: currency,
    _order_ids: orderIds,
  });
  if (error) throw error;
  return data as ChinaSplitPreview;
}

export async function setDeShipping(
  orderId: string,
  amount: number | null,
  currency: ShippingCurrency | null,
): Promise<Tables<"orders">> {
  const { data, error } = await supabase.rpc("admin_set_de_shipping", {
    _order_id: orderId,
    _amount: amount,
    _currency: currency,
  });
  if (error) throw error;
  return data as Tables<"orders">;
}

export async function clearChinaShipping(orderId: string): Promise<Tables<"orders">> {
  const { data, error } = await supabase.rpc("admin_clear_china_shipping", { _order_id: orderId });
  if (error) throw error;
  return data as Tables<"orders">;
}

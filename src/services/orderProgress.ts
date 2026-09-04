import { supabase } from "@/lib/supabaseClient";
import type { OrderProgressStatusKey } from "@/lib/orderProgress";
import type { Tables } from "@/types/database";

export type OrderProgressRow = Tables<"order_progress">;

export async function getOrderProgress(orderId: string): Promise<OrderProgressRow | null> {
  const { data, error } = await supabase.from("order_progress").select("*").eq("order_id", orderId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAdminOrderProgress(): Promise<OrderProgressRow[]> {
  const { data, error } = await supabase.from("order_progress").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function upsertOrderProgress(input: {
  orderId: string;
  statusKey: OrderProgressStatusKey;
  progressPercent: number;
  comment: string | null;
  title: string | null;
}): Promise<OrderProgressRow> {
  const { data, error } = await supabase.rpc("upsert_order_progress", {
    _order_id: input.orderId,
    _status_key: input.statusKey,
    _progress_percent: input.progressPercent,
    _comment: input.comment,
    _title: input.title,
  });
  if (error) throw error;
  return data as OrderProgressRow;
}

import { supabase } from "@/lib/supabaseClient";
import type { CartSummaryRow } from "@/types/database";

export async function listCartSummaries(): Promise<Map<string, CartSummaryRow>> {
  const { data, error } = await supabase.from("cart_summaries").select("*");
  if (error) throw error;
  const map = new Map<string, CartSummaryRow>();
  for (const row of (data ?? []) as CartSummaryRow[]) {
    map.set(row.cart_id, row);
  }
  return map;
}

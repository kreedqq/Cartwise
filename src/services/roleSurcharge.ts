import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

/** Admin-only frozen surcharge snapshots. RLS returns zero rows for non-admins. */
export async function listRoleSurchargeLines(): Promise<Tables<"order_role_surcharge_lines">[]> {
  const { data, error } = await supabase.from("order_role_surcharge_lines").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function listRoleSurchargeLinesForOrder(
  orderId: string,
): Promise<Tables<"order_role_surcharge_lines">[]> {
  const { data, error } = await supabase
    .from("order_role_surcharge_lines")
    .select("*")
    .eq("order_id", orderId);
  if (error) throw error;
  return data ?? [];
}

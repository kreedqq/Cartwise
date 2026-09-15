import { supabase } from "@/lib/supabaseClient";
import { isKitShareStatusCustomerLocked } from "@/lib/kitShareCustomerLock";

export async function fetchKitShareCustomerLockMap(
  kitShareIds: readonly string[],
): Promise<Map<string, boolean>> {
  const unique = [...new Set(kitShareIds.filter(Boolean))];
  const map = new Map<string, boolean>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase.from("kit_shares").select("id, status").in("id", unique);
  if (error) throw error;

  for (const row of data ?? []) {
    map.set(row.id, isKitShareStatusCustomerLocked(String(row.status)));
  }
  return map;
}

import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export interface DataIssuesSummary {
  unresolvedCartItems: number;
  missingPriceProducts: number;
  inactiveProductsInUse: number;
}

/** Admin-only: surfaces open data problems across all users' carts/products. */
export async function getDataIssuesSummary(): Promise<DataIssuesSummary> {
  const [unresolved, missingPrice, inactiveInUse] = await Promise.all([
    supabase.from("cart_items").select("id", { count: "exact", head: true }).eq("resolution_status", "not_found"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("price_usd", 0),
    supabase
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("resolution_status", "inactive"),
  ]);

  if (unresolved.error) throw unresolved.error;
  if (missingPrice.error) throw missingPrice.error;
  if (inactiveInUse.error) throw inactiveInUse.error;

  return {
    unresolvedCartItems: unresolved.count ?? 0,
    missingPriceProducts: missingPrice.count ?? 0,
    inactiveProductsInUse: inactiveInUse.count ?? 0,
  };
}

export type AuditLogWithLabel = Tables<"audit_logs">;

export async function listAuditLogs(limit = 100): Promise<AuditLogWithLabel[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

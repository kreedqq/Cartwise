import { supabase } from "@/lib/supabaseClient";
import type { Database, Tables } from "@/types/database";

export type OrderGroup = Tables<"order_groups">;
export type OrderGroupMembership = Tables<"order_group_orders">;

export async function listOrderGroups(): Promise<OrderGroup[]> {
  const { data, error } = await supabase
    .from("order_groups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listOrderGroupMemberships(): Promise<OrderGroupMembership[]> {
  const { data, error } = await supabase.from("order_group_orders").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function createOrderGroup(input: {
  name: string;
  note?: string | null;
  orderIds?: string[];
}): Promise<OrderGroup> {
  const name = input.name.trim();
  if (!name) throw new Error("Gruppenname fehlt.");
  const { data, error } = await supabase
    .from("order_groups")
    .insert({ name, note: emptyToNull(input.note) })
    .select("*")
    .single();
  if (error) throw error;
  if (input.orderIds?.length) {
    await assignOrdersToGroup(data.id, input.orderIds);
  }
  return data;
}

export async function updateOrderGroup(
  id: string,
  input: { name?: string; note?: string | null; archived?: boolean },
): Promise<OrderGroup> {
  const patch: Database["public"]["Tables"]["order_groups"]["Update"] = {};
  if (input.name != null) patch.name = input.name.trim();
  if (input.note !== undefined) patch.note = emptyToNull(input.note);
  if (input.archived === true) patch.archived_at = new Date().toISOString();
  if (input.archived === false) patch.archived_at = null;
  const { data, error } = await supabase.from("order_groups").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteOrderGroup(id: string): Promise<void> {
  const { error } = await supabase.from("order_groups").delete().eq("id", id);
  if (error) throw error;
}

export async function assignOrdersToGroup(groupId: string, orderIds: string[]): Promise<void> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (unique.length === 0) return;
  const { error: removeError } = await supabase.from("order_group_orders").delete().in("order_id", unique);
  if (removeError) throw removeError;
  const { error } = await supabase.from("order_group_orders").insert(
    unique.map((order_id) => ({ group_id: groupId, order_id })),
  );
  if (error) throw error;
}

export async function removeOrdersFromGroup(orderIds: string[]): Promise<void> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await supabase.from("order_group_orders").delete().in("order_id", unique);
  if (error) throw error;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

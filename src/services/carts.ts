import { supabase } from "@/lib/supabaseClient";
import { ConcurrencyError } from "@/lib/errors";
import type { CartStatus, Tables } from "@/types/database";

export async function listCarts(): Promise<Tables<"carts">[]> {
  const { data, error } = await supabase
    .from("carts")
    .select("*")
    .is("deleted_at", null)
    .order("is_active_cart", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCart(id: string): Promise<Tables<"carts"> | null> {
  const { data, error } = await supabase.from("carts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCart(userId: string, name: string, note?: string): Promise<Tables<"carts">> {
  const { data, error } = await supabase
    .from("carts")
    .insert({ user_id: userId, name, note: note || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameCart(id: string, expectedVersion: number, name: string): Promise<Tables<"carts">> {
  return updateCartOptimistic(id, expectedVersion, { name });
}

export async function updateCartNote(id: string, expectedVersion: number, note: string): Promise<Tables<"carts">> {
  return updateCartOptimistic(id, expectedVersion, { note: note || null });
}

export async function updateCartStatus(
  id: string,
  expectedVersion: number,
  status: CartStatus,
): Promise<Tables<"carts">> {
  return updateCartOptimistic(id, expectedVersion, { status });
}

async function updateCartOptimistic(
  id: string,
  expectedVersion: number,
  patch: Partial<Tables<"carts">>,
): Promise<Tables<"carts">> {
  const { data, error } = await supabase
    .from("carts")
    .update(patch)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ConcurrencyError("Dieser Warenkorb wurde zwischenzeitlich anderswo geändert.");
  return data;
}

export async function setActiveCart(id: string): Promise<void> {
  const { error } = await supabase.rpc("set_active_cart", { _cart_id: id });
  if (error) throw error;
}

export async function duplicateCart(id: string, newName: string): Promise<string> {
  const { data, error } = await supabase.rpc("duplicate_cart", { _cart_id: id, _new_name: newName });
  if (error) throw error;
  return data as string;
}

export async function archiveCart(id: string, expectedVersion: number): Promise<Tables<"carts">> {
  return updateCartOptimistic(id, expectedVersion, { status: "archived", is_active_cart: false });
}

export async function softDeleteCart(id: string): Promise<void> {
  const { error } = await supabase
    .from("carts")
    .update({ deleted_at: new Date().toISOString(), is_active_cart: false })
    .eq("id", id);
  if (error) throw error;
}

import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export async function getMyCustomerRoleName(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_my_customer_role_name");
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Server-authoritative Kit Gesuche permission for the signed-in user (fail closed). */
export async function getMyCanUseKitRequests(): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_my_can_use_kit_requests");
  if (error) throw error;
  return data === true;
}

export async function listCustomerRoles(): Promise<Tables<"customer_roles">[]> {
  const { data, error } = await supabase.from("customer_roles").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listUserCustomerRoles(): Promise<Tables<"user_customer_roles">[]> {
  const { data, error } = await supabase.from("user_customer_roles").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function upsertCustomerRole(input: {
  id?: string | null;
  name: string;
  markupPercent: number;
  isActive: boolean;
  canUseKitRequests: boolean;
}): Promise<Tables<"customer_roles">> {
  const { data, error } = await supabase.rpc("admin_upsert_customer_role", {
    _id: input.id ?? null,
    _name: input.name,
    _markup_percent: input.markupPercent,
    _is_active: input.isActive,
    _can_use_kit_requests: input.canUseKitRequests,
  });
  if (error) throw error;
  return data as Tables<"customer_roles">;
}

export async function deleteCustomerRole(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_customer_role", { _id: id });
  if (error) throw error;
}

export async function assignCustomerRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_assign_customer_role", { _user_id: userId, _role_id: roleId });
  if (error) throw error;
}

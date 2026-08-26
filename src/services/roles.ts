import { supabase } from "@/lib/supabaseClient";
import type { Role } from "@/types/database";

export async function getOwnRoles(userId: string): Promise<Role[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as Role);
}

/**
 * Grant or revoke a role for a user. Always goes through the set-user-role
 * Edge Function - user_roles has no client-writable RLS policy on purpose
 * (see docs/SECURITY.md).
 */
export async function setUserRole(userId: string, role: Role, grant: boolean): Promise<void> {
  const { data, error } = await supabase.functions.invoke("set-user-role", {
    body: { userId, role, grant },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
}

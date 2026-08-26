import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export async function getOwnProfile(userId: string): Promise<Tables<"profiles"> | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDisplayName(userId: string, displayName: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);
  if (error) throw error;
}

export interface UserWithRoles {
  id: string;
  displayName: string;
  createdAt: string;
  roles: string[];
}

/** Admin-only: list all users with their roles (joins profiles + user_roles). */
export async function listUsersWithRoles(): Promise<UserWithRoles[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, created_at")
    .order("created_at", { ascending: false });
  if (profilesError) throw profilesError;

  const { data: roles, error: rolesError } = await supabase.from("user_roles").select("user_id, role");
  if (rolesError) throw rolesError;

  const rolesByUser = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    createdAt: p.created_at,
    roles: rolesByUser.get(p.id) ?? [],
  }));
}

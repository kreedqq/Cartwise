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
  username: string | null;
  createdAt: string;
  roles: string[];
  usernameRequiredOnNextLogin: boolean;
  hasTelegramIdentity: boolean;
}

/** Admin-only: list all users with their roles (joins profiles + user_roles). */
export async function listUsersWithRoles(): Promise<UserWithRoles[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, created_at, username_required_on_next_login")
    .order("created_at", { ascending: false });
  if (profilesError) throw profilesError;

  const { data: roles, error: rolesError } = await supabase.from("user_roles").select("user_id, role");
  if (rolesError) throw rolesError;

  const { data: telegramLinked, error: telegramError } = await supabase.rpc(
    "admin_list_telegram_linked_user_ids",
  );
  if (telegramError) throw telegramError;
  const telegramIds = new Set((telegramLinked ?? []).map(String));

  const rolesByUser = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    createdAt: p.created_at,
    roles: rolesByUser.get(p.id) ?? [],
    usernameRequiredOnNextLogin: Boolean(p.username_required_on_next_login),
    hasTelegramIdentity: telegramIds.has(p.id),
  }));
}

/** Admin-only RPC: require Telegram linking on the next login (no Telegram identity yet). */
export async function adminSetUsernameRequired(userId: string, required: boolean): Promise<boolean> {
  const { error } = await supabase.rpc("admin_set_username_required", {
    _user_id: userId,
    _required: required,
  });
  if (error) throw error;

  // Read back from DB — never trust only local React state.
  const { data, error: readError } = await supabase
    .from("profiles")
    .select("username_required_on_next_login")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw readError;
  const stored = Boolean(data?.username_required_on_next_login);
  if (stored !== required) {
    throw new Error("Telegram-Anforderung wurde nicht in der Datenbank gespeichert.");
  }
  return stored;
}

/** Admin-only RPC: set profiles.username directly and clear any change request. */
export async function adminSetUsername(userId: string, username: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_set_username", {
    _user_id: userId,
    _username: username,
  });
  if (error) throw error;
  return String(data);
}

/** Admin-only RPC: delete the auth account. Historical orders stay. */
export async function adminDeleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_user", { _user_id: userId });
  if (error) throw error;
}

/**
 * Admin-only: remove custom:telegram from a user who still has another login method.
 * Never locks out telegram-only accounts. Does not clear profiles.username.
 */
export async function adminRemoveTelegramIdentity(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_remove_telegram_identity", {
    _user_id: userId,
  });
  if (error) throw error;
}

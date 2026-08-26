import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Builds two Supabase clients an Edge Function typically needs:
 *  - `asUser`: uses the caller's JWT, so RLS applies exactly as it would in
 *    the browser. Used to double check permissions the same way the
 *    database would.
 *  - `asService`: uses the service-role key (only ever available as a
 *    Supabase secret, never shipped to the client) to perform the actual
 *    privileged write after we have verified the caller is allowed to.
 */
export function buildClients(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const asUser: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const asService: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return { asUser, asService };
}

export async function requireAdmin(asUser: SupabaseClient): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Nicht angemeldet." };
  }

  const { data: isAdmin, error: roleError } = await asUser.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });

  if (roleError) {
    return { ok: false, status: 500, error: "Rolle konnte nicht geprüft werden." };
  }
  if (!isAdmin) {
    return { ok: false, status: 403, error: "Nur Admins dürfen diese Aktion ausführen." };
  }

  return { ok: true, userId: userData.user.id };
}

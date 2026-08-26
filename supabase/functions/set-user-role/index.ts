// set-user-role
//
// The ONLY way (besides the one-time SQL bootstrap in docs/FIRST_ADMIN.md)
// that a role can be granted or revoked. RLS deliberately has no client-side
// write policy on user_roles (see docs/SECURITY.md), so this function is the
// sole gate: it re-verifies (server-side, never trusting the caller's
// frontend state) that the caller already holds the admin role before
// touching anything, and prevents an admin from revoking their own last
// admin role (which would lock everyone out of the admin area).

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildClients, requireAdmin } from "../_shared/auth.ts";

interface SetRoleBody {
  userId: string;
  role: "admin" | "user";
  grant: boolean; // true = add role, false = remove role
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 }, origin);
  }

  const { asUser, asService } = buildClients(req);
  const adminCheck = await requireAdmin(asUser);
  if (!adminCheck.ok) {
    return jsonResponse({ error: adminCheck.error }, { status: adminCheck.status }, origin);
  }

  let body: SetRoleBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Request-Body." }, { status: 400 }, origin);
  }

  if (!body.userId || (body.role !== "admin" && body.role !== "user") || typeof body.grant !== "boolean") {
    return jsonResponse({ error: "userId, role ('admin'|'user') und grant (boolean) werden benötigt." }, { status: 400 }, origin);
  }

  // Guard: an admin may not revoke their own admin role (would risk locking
  // out all admins if they are the only one). They can still be demoted by
  // a *different* admin.
  if (!body.grant && body.role === "admin" && body.userId === adminCheck.userId) {
    return jsonResponse(
      { error: "Du kannst dir nicht selbst die Admin-Rolle entziehen. Bitte einen anderen Admin bitten." },
      { status: 400 },
      origin,
    );
  }

  try {
    if (body.grant) {
      const { error } = await asService
        .from("user_roles")
        .upsert({ user_id: body.userId, role: body.role }, { onConflict: "user_id,role" });
      if (error) throw error;

      await asService.rpc("log_audit", {
        _actor_id: adminCheck.userId,
        _action: "role.grant",
        _entity_type: "user_role",
        _entity_id: body.userId,
        _before: null,
        _after: { user_id: body.userId, role: body.role },
      });
    } else {
      // Prevent removing the very last admin in the system entirely.
      if (body.role === "admin") {
        const { count, error: countError } = await asService
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin");
        if (countError) throw countError;
        if ((count ?? 0) <= 1) {
          return jsonResponse(
            { error: "Es muss mindestens ein Admin bestehen bleiben." },
            { status: 400 },
            origin,
          );
        }
      }

      const { error } = await asService
        .from("user_roles")
        .delete()
        .eq("user_id", body.userId)
        .eq("role", body.role);
      if (error) throw error;

      await asService.rpc("log_audit", {
        _actor_id: adminCheck.userId,
        _action: "role.revoke",
        _entity_type: "user_role",
        _entity_id: body.userId,
        _before: { user_id: body.userId, role: body.role },
        _after: null,
      });
    }

    return jsonResponse({ ok: true }, { status: 200 }, origin);
  } catch (error) {
    console.error("set-user-role failed:", error);
    return jsonResponse({ error: "Rolle konnte nicht geändert werden." }, { status: 500 }, origin);
  }
});

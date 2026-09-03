import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}));

const { adminSetUsernameRequired, adminDeleteUser, listUsersWithRoles } = await import("@/services/profiles");

describe("admin users and roles merge", () => {
  it("keeps Benutzer & Rollen as one subtab and does not show the old split tabs", () => {
    const nav = readSource("src/lib/adminNav.ts");
    expect(nav).toContain('label: "Benutzer & Rollen"');
    expect(nav).toContain('to: "/admin/surcharges"');
    expect(nav).toContain('to: "/admin/audit-log"');
    expect(nav).not.toContain('label: "Rollen & Preisaufschlag"');
    expect(nav).not.toMatch(/to: "\/admin\/users", label: "Benutzer"/);
  });

  it("keeps /admin/roles as a deep link to the merged page", () => {
    expect(readSource("src/App.tsx")).toContain('path="roles"');
    expect(readSource("src/pages/admin/AdminRoles.tsx")).toContain('to="/admin/users"');
    expect(readSource("src/pages/admin/AdminRoles.tsx")).toContain("Navigate");
  });

  it("shows Telegram Benutzername, role markup, username-required, manage, and delete on the merged page", () => {
    const page = readSource("src/pages/admin/AdminUsers.tsx");
    expect(page).toContain("Telegram Benutzername");
    expect(page).toContain("Username erforderlich");
    expect(page).toContain("Verwalten");
    expect(page).toContain("Benutzer dauerhaft entfernen");
    expect(page).toContain("Telegram Benutzername beim nächsten Login erforderlich");
    expect(page).toContain("AdminRoleCatalog");
    expect(page).toContain("assignCustomerRole");
    expect(page).toContain("groupUsersForAdminTables");
    expect(page).not.toContain("Interner Name");
    expect(page).not.toContain("displayName");
  });

  it("keeps the role catalog markup editor without a new 25% engine", () => {
    const catalog = readSource("src/pages/admin/AdminRoleCatalog.tsx");
    expect(catalog).toContain("upsertCustomerRole");
    expect(catalog).toContain("Aufschlag %");
    expect(catalog).not.toMatch(/price \* 1\.25|0\.25/);
    expect(readSource("src/pages/admin/AdminUsers.tsx")).not.toMatch(/price \* 1\.25/);
  });
});

describe("admin username-required and delete RPCs", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it("sets the per-user flag through admin_set_username_required", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await adminSetUsernameRequired("user-2", true);
    expect(rpc).toHaveBeenCalledWith("admin_set_username_required", {
      _user_id: "user-2",
      _required: true,
    });
  });

  it("deletes an account through admin_delete_user and never a client table delete of orders", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await adminDeleteUser("user-2");
    expect(rpc).toHaveBeenCalledWith("admin_delete_user", { _user_id: "user-2" });
    expect(from).not.toHaveBeenCalled();
  });

  it("lists username_required_on_next_login for the admin table", async () => {
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: "user-2",
                  username: "Beispiel",
                  created_at: "2026-09-02T00:00:00.000Z",
                  username_required_on_next_login: true,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: async () => ({ data: [{ user_id: "user-2", role: "user" }], error: null }),
      };
    });
    const users = await listUsersWithRoles();
    expect(users).toEqual([
      {
        id: "user-2",
        username: "Beispiel",
        createdAt: "2026-09-02T00:00:00.000Z",
        roles: ["user"],
        usernameRequiredOnNextLogin: true,
      },
    ]);
  });
});

describe("0046 username required and admin user delete", () => {
  const sql = readSource("supabase/migrations/0046_username_required_and_admin_user_delete.sql");

  it("adds a per-user boolean flag defaulting to false", () => {
    expect(sql).toMatch(/username_required_on_next_login boolean not null default false/);
  });

  it("lets only admins set the flag and blocks client updates of the column", () => {
    expect(sql).toMatch(/admin_set_username_required/);
    expect(sql).toMatch(/has_role\(auth\.uid\(\), 'admin'\)/);
    expect(sql).toMatch(/username_required_on_next_login darf nicht clientseitig geändert werden/);
    expect(sql).toMatch(/current_user = 'authenticated'/);
    const triggerFn = sql.slice(
      sql.indexOf("protect_username_required_flag"),
      sql.indexOf("drop trigger if exists profiles_protect_username_required"),
    );
    expect(triggerFn).not.toMatch(/security definer/i);
  });

  it("clears the flag when the user claims a username", () => {
    expect(sql).toMatch(/username_required_on_next_login = false/);
    expect(sql).toMatch(/function public\.set_username/);
    expect(sql).toMatch(/perform public\.sync_cart_titles_for_user\(_uid\)/);
  });

  it("keeps historical orders by nulling user_id instead of cascade-deleting them", () => {
    expect(sql).toMatch(/alter table public\.orders alter column user_id drop not null/);
    expect(sql).toMatch(/on delete set null/);
    expect(sql).toMatch(/update public\.orders\s+set user_id = null/s);
    expect(sql).not.toMatch(/delete from public\.orders/);
    expect(sql).not.toMatch(/delete from public\.order_items/);
    expect(sql).not.toMatch(/delete from public\.order_role_surcharge_lines/);
  });

  it("only lets admins delete another account, never self or the last admin", () => {
    expect(sql).toMatch(/Nur Admins dürfen Benutzer entfernen/);
    expect(sql).toMatch(/Du kannst deinen eigenen Account nicht löschen/);
    expect(sql).toMatch(/Es muss mindestens ein Admin bestehen bleiben/);
    expect(sql).toMatch(/delete from auth\.users where id = _user_id/);
    expect(sql).toMatch(/log_audit\(/);
    expect(sql).toMatch(/user\.delete/);
  });

  it("does not destroy other members' kits or introduce a 25% formula", () => {
    expect(sql).toMatch(/delete from public\.kit_share_participants/);
    expect(sql).toMatch(/set creator_user_id = coalesce/);
    expect(sql).not.toMatch(/0\.25|1\.25/);
    expect(sql).not.toMatch(/apply_role_markup|sell_unit_price/);
  });
});

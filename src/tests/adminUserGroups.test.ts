import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  adminUserTelegramLabel,
  compareTelegramUsernames,
  groupUsersForAdminTables,
} from "@/lib/adminUserGroups";
import type { UserWithRoles } from "@/services/profiles";

function user(overrides: Partial<UserWithRoles> & { id: string; username: string | null }): UserWithRoles {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    roles: [],
    usernameRequiredOnNextLogin: false,
    ...overrides,
  };
}

describe("admin user grouping by catalog roles", () => {
  it("creates a section for every catalog role including a newly added one", () => {
    const users = [
      user({ id: "a", username: "Raff", roles: [] }),
      user({ id: "b", username: "PepsiDry", roles: [] }),
      user({ id: "c", username: "AdminUser", roles: ["admin"] }),
      user({ id: "d", username: null, roles: [] }),
    ];
    const roles = [
      { id: "kunde", name: "Kunde" },
      { id: "vip", name: "VIP" },
      { id: "reseller", name: "Reseller" },
    ];
    const assignment = new Map<string, string>([
      ["a", "kunde"],
      ["b", "kunde"],
    ]);
    const groups = groupUsersForAdminTables(users, roles, assignment, "");
    expect(groups.map((group) => group.title)).toEqual(["Admin", "Kunde", "VIP", "Reseller", "Ohne Rolle"]);
    expect(groups.find((group) => group.title === "Admin")?.users.map((row) => row.username)).toEqual(["AdminUser"]);
    expect(groups.find((group) => group.title === "Kunde")?.users.map((row) => row.username)).toEqual(["PepsiDry", "Raff"]);
    expect(groups.find((group) => group.title === "VIP")?.users).toEqual([]);
    expect(groups.find((group) => group.title === "Reseller")?.users).toEqual([]);
    expect(groups.find((group) => group.title === "Ohne Rolle")?.users.map((row) => row.id)).toEqual(["d"]);
  });

  it("places unassigned users into the default catalog role instead of Ohne Rolle", () => {
    const users = [user({ id: "a", username: "Raff", roles: [] })];
    const groups = groupUsersForAdminTables(users, [{ id: "kunde", name: "Kunde" }], new Map(), "kunde");
    expect(groups.find((group) => group.title === "Kunde")?.users.map((row) => row.id)).toEqual(["a"]);
    expect(groups.find((group) => group.title === "Ohne Rolle")?.users).toEqual([]);
  });

  it("sorts missing telegram usernames last and never uses display_name", () => {
    expect(compareTelegramUsernames(null, "Raff")).toBeGreaterThan(0);
    expect(compareTelegramUsernames("PepsiDry", "Raff")).toBeLessThan(0);
    expect(adminUserTelegramLabel("PepsiDry")).toBe("@PepsiDry");
    expect(adminUserTelegramLabel(null)).toBe("Nicht verfügbar");
    expect(readFileSync(resolve(process.cwd(), "src/lib/adminUserGroups.ts"), "utf8")).not.toContain("display_name");
    expect(readFileSync(resolve(process.cwd(), "src/pages/admin/AdminUsers.tsx"), "utf8")).not.toContain("Interner Name");
    expect(readFileSync(resolve(process.cwd(), "src/pages/admin/AdminUsers.tsx"), "utf8")).toContain("groupUsersForAdminTables");
    expect(readFileSync(resolve(process.cwd(), "src/pages/admin/AdminUsers.tsx"), "utf8")).toContain("AdminRoleCatalog");
    expect(readFileSync(resolve(process.cwd(), "src/pages/admin/AdminUsers.tsx"), "utf8")).toContain("adminDeleteUser");
  });
});

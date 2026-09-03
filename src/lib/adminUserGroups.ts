import { telegramHandleLabel } from "@/lib/username";
import type { UserWithRoles } from "@/services/profiles";

export interface AdminUserRoleGroup {
  id: string;
  title: string;
  users: UserWithRoles[];
}

export interface CustomerRoleOption {
  id: string;
  name: string;
}

export function compareTelegramUsernames(a: string | null | undefined, b: string | null | undefined): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && right) return 1;
  if (left && !right) return -1;
  return left.localeCompare(right, "de", { sensitivity: "base" });
}

/** Admin users list identity. Missing handle stays „Nicht verfügbar“. */
export function adminUserTelegramLabel(username: string | null | undefined): string {
  const value = username?.trim();
  if (!value) return "Nicht verfügbar";
  return telegramHandleLabel(value);
}

/**
 * One table per catalog customer role (dynamic). Admins are listed once under
 * Admin. Unassigned users with no default role go to Ohne Rolle.
 * Does not change role assignment or markup.
 */
export function groupUsersForAdminTables(
  users: UserWithRoles[],
  customerRoles: CustomerRoleOption[],
  assignmentByUser: Map<string, string>,
  defaultRoleId: string,
): AdminUserRoleGroup[] {
  const sorted = [...users].sort((a, b) => compareTelegramUsernames(a.username, b.username));
  const groups: AdminUserRoleGroup[] = [
    {
      id: "system-admin",
      title: "Admin",
      users: sorted.filter((user) => user.roles.includes("admin")),
    },
  ];

  const nonAdmins = sorted.filter((user) => !user.roles.includes("admin"));
  const placed = new Set<string>();

  for (const role of customerRoles) {
    const members = nonAdmins.filter((user) => (assignmentByUser.get(user.id) ?? defaultRoleId) === role.id);
    for (const member of members) placed.add(member.id);
    groups.push({ id: role.id, title: role.name, users: members });
  }

  groups.push({
    id: "ohne-rolle",
    title: "Ohne Rolle",
    users: nonAdmins.filter((user) => !placed.has(user.id)),
  });

  return groups;
}

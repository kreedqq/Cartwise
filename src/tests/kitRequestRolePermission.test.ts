import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("kit request role permissions", () => {
  const migration = read("supabase/migrations/0089_kit_request_role_permission.sql");

  it("adds fail-closed can_use_kit_requests on customer_roles", () => {
    expect(migration).toContain("add column if not exists can_use_kit_requests boolean not null default false");
    expect(migration).toContain("upper(trim(name)) = 'GROUP BUY'");
    expect(migration).toContain("can_use_kit_requests = true");
    expect(migration).toContain("user_can_use_kit_requests");
    expect(migration).toContain("assert_user_can_use_kit_requests");
    expect(migration).toContain("get_my_can_use_kit_requests");
  });

  it("enforces permission on create/join/list/preview/requestable RPCs", () => {
    expect(migration).toContain("'create_kit_request'");
    expect(migration).toContain("'join_kit_request'");
    expect(migration).toContain("'preview_kit_request_join'");
    expect(migration).toContain("'list_kit_requestable_product_ids'");
    expect(migration).toContain("assert_user_can_use_kit_requests(_uid)");
    expect(migration).toContain("list_open_kit_requests");
    expect(migration).toContain("''items'', ''[]''::jsonb");
  });

  it("does not gate leave/list_my on the role flag (existing participation)", () => {
    expect(migration).not.toMatch(/'leave_kit_request'/);
    expect(migration).not.toMatch(/'list_my_kit_requests'/);
    expect(migration).not.toMatch(/'list_my_kit_request_participations'/);
    expect(migration).not.toMatch(/'cancel_kit_request'/);
  });

  it("keeps admin kit management independent of customer role flag", () => {
    expect(migration).not.toMatch(/admin_list_kit_requests/);
    expect(migration).not.toMatch(/admin_get_kit_request/);
    expect(migration).toContain("has_role(_uid, 'admin')");
  });

  it("extends admin role upsert + UI checkbox", () => {
    expect(migration).toContain("admin_upsert_customer_role");
    expect(migration).toContain("_can_use_kit_requests");
    expect(read("src/pages/admin/AdminRoleCatalog.tsx")).toContain("Kit Gesuche erlaubt");
    expect(read("src/services/customerRoles.ts")).toContain("canUseKitRequests");
    expect(read("src/services/customerRoles.ts")).toContain("get_my_can_use_kit_requests");
  });

  it("hides Kit Gesuche UX when role is denied", () => {
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).toContain("canUseKitRequests");
    expect(read("src/pages/GroupBuy.tsx")).toContain("useCanUseKitRequests");
    expect(read("src/pages/KitRequests.tsx")).toContain("KIT_REQUEST_ROLE_DENIED_MESSAGE");
    expect(read("src/lib/kitRequests.ts")).toContain(
      "Kit Gesuche sind für deine aktuelle Rolle nicht freigeschaltet.",
    );
  });
});

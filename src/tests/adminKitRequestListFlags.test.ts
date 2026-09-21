import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("0126 admin kit list cancel flags", () => {
  const sql = read("supabase/migrations/0126_admin_kit_list_cancel_flags.sql");

  it("does not gate canCancel on is_open_request", () => {
    expect(sql).toContain("'canCancel', _kit.status in ('open', 'full', 'ordered', 'expired')");
    expect(sql).not.toContain("coalesce(_kit.is_open_request");
  });

  it("does not gate canDelete on is_open_request", () => {
    expect(sql).toContain("_kit.status = 'cancelled'");
    expect(sql).not.toMatch(/'canDelete',\s*\n\s*coalesce\(_kit\.is_open_request/);
  });

  it("leaves customer migration 0113 untouched", () => {
    const customer = read("supabase/migrations/0113_kit_request_customer_no_leave_cancel.sql");
    expect(customer).toContain("Nur ein Admin kann ein Kit-Gesuch stornieren");
    expect(sql).not.toMatch(/create or replace function public\.cancel_kit_request/);
  });

  it("does not replace bulk cancel/delete RPCs from 0125", () => {
    expect(sql).not.toContain("admin_cancel_kit_requests");
    expect(sql).not.toContain("admin_delete_kit_requests");
    expect(sql).not.toContain("admin_kit_request_delete_linked_orders");
  });
});

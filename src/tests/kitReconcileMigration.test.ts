import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("0108–0110 kit reconcile migrations", () => {
  const m0108 = read("0108_kit_share_state_projection.sql");
  const m0109 = read("0109_kit_share_reconcile_extend.sql");
  const m0110 = read("0110_kit_share_reconcile_readonly_fix.sql");

  it("0108 is read-only projection only", () => {
    expect(m0108).not.toMatch(/\b(insert|update|delete|truncate)\b/i);
    expect(m0108).toContain("kit_share_project_state");
    expect(m0108).toContain("kit_share_reconcile_report");
    expect(m0108).not.toMatch(/create table/i);
    expect(m0108).not.toMatch(/create trigger/i);
  });

  it("0109 extends reconcile without mutations", () => {
    expect(m0109).toContain("create or replace function public.kit_share_reconcile_report");
    expect(m0109).not.toMatch(/\b(insert|update|delete|truncate)\b/i);
    expect(m0109).toContain("WRONG_CART_QUANTITY");
    expect(m0109).toContain("DUPLICATE_CART_LINE");
    expect(m0109).toContain("MISSING_CART_LINE");
    expect(m0109).toContain("HISTORICAL_ORDER_SNAPSHOT_MISMATCH");
  });

  it("0110 avoids kit_share_target_cart_id (read-only safe)", () => {
    expect(m0110).toContain("create or replace function public.kit_share_reconcile_report");
    expect(m0110).not.toContain("kit_share_target_cart_id");
  });
});

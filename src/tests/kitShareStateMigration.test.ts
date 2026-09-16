import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("0108 kit share state projection migration", () => {
  const sql = readMigration("0108_kit_share_state_projection.sql");

  it("defines central projection and reconcile report", () => {
    expect(sql).toContain("kit_share_project_state");
    expect(sql).toContain("kit_share_reconcile_report");
    expect(sql).toContain("kit_share_almost_full_threshold");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("uses threshold 2 matching TS constant", () => {
    expect(sql).toMatch(/select\s+2\s*;/);
  });
});

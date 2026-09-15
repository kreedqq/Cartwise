import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0102 historical kit sync recovery", () => {
  const sql = readMigration("0102_historical_kit_sync_recovery.sql");

  it("defines evaluate and apply RPCs with admin gate", () => {
    expect(sql).toContain("kit_sync_recovery_evaluate");
    expect(sql).toContain("admin_apply_historical_kit_sync_recovery");
    expect(sql).toMatch(/has_role\(_admin, 'admin'\)/);
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("blocks HeyAnna5 order number", () => {
    expect(sql).toContain("CW-2026-000063");
  });

  it("uses idempotency via kit_share_id_snapshot", () => {
    expect(sql).toContain("kit_share_id_snapshot = _kit_share_id");
    expect(sql).toContain("recovery_already_applied");
  });

  it("writes revision and audit", () => {
    expect(sql).toContain("order_revisions");
    expect(sql).toContain("order.add_historical_line");
    expect(sql).toContain("add_historical_kit_line");
  });

  it("does not use live catalog pricing for surcharge base", () => {
    expect(sql).not.toContain("kit_share_catalog_unit_usd");
    expect(sql).toContain("normal_price_usd_snapshot");
  });

  it("0103 fixes customer role join column", () => {
    const fix = readMigration("0103_fix_historical_kit_recovery_role_join.sql");
    expect(fix).toMatch(/cr\.id = ucr\.role_id/);
  });

  it("wires admin UI", () => {
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("AdminHistoricalKitRecoveryDialog");
    expect(read("src/services/adminHistoricalKitRecovery.ts")).toContain("kit_sync_recovery_evaluate");
  });
});

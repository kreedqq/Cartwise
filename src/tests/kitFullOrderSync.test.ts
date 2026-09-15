import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  kitFullOrderSyncListLabel,
  kitFullOrderSyncParticipantLabel,
} from "@/lib/kitFullOrderSync";

function readMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0104 kit full order sync", () => {
  const sql = readMigration("0104_kit_full_order_sync.sql");

  it("hooks OPEN→FULL before cart repricing", () => {
    expect(sql).toContain("kit_share_on_became_full");
    expect(sql).toContain("kit_full_order_sync_kit");
    expect(sql).toMatch(/kit_full_order_sync_kit\([\s\S]*kit_share_sync_all_participant_carts/);
  });

  it("uses order revision + idempotent kit_share_id_snapshot", () => {
    expect(sql).toContain("order_revisions");
    expect(sql).toContain("kit_share_id_snapshot = _kit_share_id");
    expect(sql).toContain("revision_number");
  });

  it("writes kit_order.auto_sync audit", () => {
    expect(sql).toContain("kit_order.auto_sync");
  });

  it("does not hardcode HeyAnna5 or CW-2026-000063", () => {
    expect(sql).not.toContain("HeyAnna5");
    expect(sql).not.toContain("CW-2026-000063");
  });

  it("exposes admin manual sync RPC", () => {
    expect(sql).toContain("admin_sync_kit_full_orders");
    expect(sql).toMatch(/assert_admin_kit_request/);
  });

  it("reuses post-full historical template from 0102 when checkout after full", () => {
    expect(sql).toContain("kit_sync_recovery_historical_cart_template");
    expect(sql).toContain("kit_full_order_sync_historical_price");
    expect(sql).toContain("ks_ci.product_id is not distinct from _kit.product_id");
    expect(sql).toContain("trunc((_price->>'bulkMinQty')::numeric)::integer");
  });

  it("wires admin kit request UI fields", () => {
    expect(read("src/services/adminKitRequests.ts")).toContain("admin_sync_kit_full_orders");
    expect(read("src/pages/admin/AdminKitRequests.tsx")).toContain("Bestell-Sync");
    expect(read("src/pages/admin/AdminKitRequestDetail.tsx")).toContain("Bestellungen synchronisieren");
  });
});

describe("kitFullOrderSync labels", () => {
  it("maps list labels", () => {
    expect(kitFullOrderSyncListLabel("all_synced")).toContain("Alle Teilnehmer");
    expect(kitFullOrderSyncListLabel("partial_synced", 1, 2)).toContain("1 von 2");
    expect(kitFullOrderSyncParticipantLabel("pending_no_price")).toContain("Preis");
  });
});

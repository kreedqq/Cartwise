import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveKitShareIdForItem } from "@/lib/kitOrderSummary";

function readMigration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0092 order correction and kit snapshots", () => {
  const sql = readMigration("0092_order_corrections_and_kit_snapshots.sql");

  it("adds frozen kit columns on order_items", () => {
    expect(sql).toContain("kit_share_id_snapshot");
    expect(sql).toContain("kit_size_vials_snapshot");
    expect(sql).toContain("kit_participant_quantity_snapshot");
    expect(sql).toMatch(/on delete set null/);
  });

  it("stamps kit snapshots in create_one_area_order insert", () => {
    expect(sql).toMatch(/kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot/);
    expect(sql).toContain("_kit.kit_size_vials");
    expect(sql).toContain("_kit_participant.quantity");
  });

  it("defines order_revisions audit table", () => {
    expect(sql).toContain("create table if not exists public.order_revisions");
    expect(sql).toContain("unique (order_id, revision_number)");
  });

  it("wires admin order correction UI", () => {
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("Bestellung korrigieren");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("AdminOrderCorrectionDialog");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("Änderungsverlauf");
  });

  it("admin_apply_order_correction uses frozen unit_price_usd_snapshot", () => {
    expect(sql).toContain("admin_apply_order_correction");
    expect(sql).toMatch(/_sell_unit := _item\.unit_price_usd_snapshot/);
    expect(sql).toContain("_expected_revision");
    expect(sql).toContain("order.correct");
  });

  it("0087 still blocks kit redistribution when participant ordered", () => {
    const m87 = readMigration("0087_admin_kit_request_distribution.sql");
    expect(m87).toMatch(/ordered_at is not null or order_id is not null/);
  });
});

describe("resolveKitShareIdForItem prefers order snapshot", () => {
  const emptyContext = { kits: [], participants: [], cartLinks: [] };

  it("returns kit_share_id_snapshot without live kit context", () => {
    const id = resolveKitShareIdForItem(
      {
        order_id: "o1",
        product_id: "p1",
        quantity: 4,
        kit_share_id_snapshot: "kit-frozen",
      },
      { id: "o1", cart_id: "c1", user_id: "u1" },
      emptyContext,
    );
    expect(id).toBe("kit-frozen");
  });
});

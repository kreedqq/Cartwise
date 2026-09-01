import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { applyRoleMarkup, sellingUnitPrice } from "@/lib/money";
import {
  lineRoleSurchargeFromSnapshots,
  orderRoleSurchargeFromSnapshots,
  summarizeRoleSurcharges,
  type RoleSurchargeSnapshotLine,
} from "@/lib/roleSurcharge";

const CATALOG = { price_usd: 100, bulk_price_usd: 90, bulk_price_min_quantity: 10 };
const OIL = { price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 };

function snap(overrides: Partial<RoleSurchargeSnapshotLine> = {}): RoleSurchargeSnapshotLine {
  return {
    order_id: "ord-1",
    order_item_id: "item-1",
    catalog_unit_price_usd: 16,
    selling_unit_price_usd: 20,
    quantity: 10,
    base_line_usd: 160,
    selling_line_usd: 200,
    surcharge_usd: 40,
    customer_role_name_snapshot: "Kunde",
    ...overrides,
  };
}

describe("existing role pricing is unchanged", () => {
  it("keeps Kunde 25% selling prices", () => {
    expect(applyRoleMarkup(100, 25)).toBe(125);
    expect(sellingUnitPrice(CATALOG, 1, 25)).toBe(125);
    expect(sellingUnitPrice(CATALOG, 10, 25)).toBe(112.5);
  });

  it("keeps a different existing markup (10%)", () => {
    expect(applyRoleMarkup(100, 10)).toBe(110);
    expect(sellingUnitPrice(CATALOG, 1, 10)).toBe(110);
  });

  it("keeps Stammkunde / 0% with no difference", () => {
    expect(applyRoleMarkup(100, 0)).toBe(100);
    expect(sellingUnitPrice(CATALOG, 10, 0)).toBe(90);
  });

  it("keeps a later 30% markup without a hardcoded report rate", () => {
    expect(applyRoleMarkup(100, 30)).toBe(130);
  });

  it("keeps oils quantity-tier unit 16 before any markup", () => {
    expect(sellingUnitPrice(OIL, 9, 0)).toBe(18);
    expect(sellingUnitPrice(OIL, 10, 0)).toBe(16);
    expect(sellingUnitPrice(OIL, 10, 25)).toBe(20);
  });
});

describe("lineRoleSurchargeFromSnapshots", () => {
  it("oils qty 10: catalog 16, selling 20 → 40 USD surcharge", () => {
    const line = lineRoleSurchargeFromSnapshots({
      catalogUnitPriceUsd: sellingUnitPrice(OIL, 10, 0),
      sellingUnitPriceUsd: sellingUnitPrice(OIL, 10, 25),
      quantity: 10,
      sellingLineUsd: 200,
    });
    expect(line).toEqual({
      catalogUnitPriceUsd: 16,
      sellingUnitPriceUsd: 20,
      quantity: 10,
      baseLineUsd: 160,
      sellingLineUsd: 200,
      surchargeUsd: 40,
    });
  });

  it("0% markup yields zero surcharge", () => {
    const line = lineRoleSurchargeFromSnapshots({
      catalogUnitPriceUsd: 16,
      sellingUnitPriceUsd: 16,
      quantity: 10,
      sellingLineUsd: 160,
    });
    expect(line?.surchargeUsd).toBe(0);
  });

  it("does not treat 160 as a unit price (never 1600)", () => {
    const line = lineRoleSurchargeFromSnapshots({
      catalogUnitPriceUsd: 16,
      sellingUnitPriceUsd: 20,
      quantity: 10,
      sellingLineUsd: 200,
    });
    expect(line?.baseLineUsd).toBe(160);
    expect(line?.surchargeUsd).not.toBe(400);
  });
});

describe("summarizeRoleSurcharges", () => {
  it("groups frozen role names and does not use a later role change", () => {
    const report = summarizeRoleSurcharges(
      [
        snap({ order_id: "old", customer_role_name_snapshot: "Kunde", surcharge_usd: 40, base_line_usd: 160, selling_line_usd: 200 }),
      ],
      [{ id: "old", status: "completed", exchange_rate: 0.85, total_usd: 200 }],
      ["old"],
    );
    expect(report.totalSurchargeUsd).toBe(40);
    expect(report.totalSurchargeEur).toBe(34);
    expect(report.byRole).toEqual([
      { roleName: "Kunde", surchargeUsd: 40, surchargeEur: 34, lineCount: 1, orderCount: 1 },
    ]);
  });

  it("omits historical orders without a snapshot instead of using the current role", () => {
    const report = summarizeRoleSurcharges(
      [],
      [{ id: "legacy", status: "completed", exchange_rate: 0.85, total_usd: 200 }],
      ["legacy"],
    );
    expect(report.totalSurchargeUsd).toBe(0);
    expect(report.skippedUnauditableOrderCount).toBe(1);
    expect(report.byRole).toEqual([]);
  });

  it("excludes cancelled orders", () => {
    const report = summarizeRoleSurcharges(
      [snap({ order_id: "cx", surcharge_usd: 40 })],
      [{ id: "cx", status: "cancelled", exchange_rate: 0.85, total_usd: 200 }],
      ["cx"],
    );
    expect(report.totalSurchargeUsd).toBe(0);
    expect(report.skippedCancelledOrderCount).toBe(1);
  });

  it("splits multiple frozen roles without a hardcoded 25%", () => {
    const report = summarizeRoleSurcharges(
      [
        snap({ order_id: "a", order_item_id: "1", customer_role_name_snapshot: "Kunde", surcharge_usd: 1250, base_line_usd: 5000, selling_line_usd: 6250 }),
        snap({ order_id: "b", order_item_id: "2", customer_role_name_snapshot: "Händler", surcharge_usd: 350, base_line_usd: 3500, selling_line_usd: 3850 }),
      ],
      [
        { id: "a", status: "completed", exchange_rate: 0.8488, total_usd: 6250 },
        { id: "b", status: "completed", exchange_rate: 0.8457, total_usd: 3850 },
      ],
      ["a", "b"],
    );
    expect(report.totalSurchargeUsd).toBe(1600);
    expect(report.byRole.map((row) => row.roleName)).toEqual(["Händler", "Kunde"]);
  });
});

describe("orderRoleSurchargeFromSnapshots", () => {
  it("sums catalog / surcharge / selling for a PDF block", () => {
    expect(orderRoleSurchargeFromSnapshots([snap(), snap({ order_item_id: "item-2", surcharge_usd: 10, base_line_usd: 40, selling_line_usd: 50 })])).toEqual({
      catalogSubtotalUsd: 200,
      surchargeUsd: 50,
      sellingSubtotalUsd: 250,
    });
  });

  it("returns null when no snapshots exist (do not invent a percent)", () => {
    expect(orderRoleSurchargeFromSnapshots([])).toBeNull();
  });
});

describe("reporting source must not invent a 25% engine", () => {
  it("does not hardcode 0.25 or 1.25 in the surcharge reporter or migration", () => {
    const lib = readFileSync(resolve(process.cwd(), "src/lib/roleSurcharge.ts"), "utf8");
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0044_order_role_surcharge_snapshots.sql"), "utf8");
    const customerDetail = readFileSync(resolve(process.cwd(), "src/pages/OrderDetail.tsx"), "utf8");
    expect(lib).not.toMatch(/0\.25|1\.25|\* 25/);
    expect(sql).not.toMatch(/0\.25|1\.25|\* 25/);
    expect(sql).toMatch(/sell_unit_price\(/);
    expect(sql).toMatch(/, 0\s*\)/);
    expect(customerDetail).not.toContain("Rollenaufschlag");
  });
});

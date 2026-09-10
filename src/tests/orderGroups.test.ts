import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}));

import {
  countOrderItems,
  groupNameForOrder,
  membershipByOrderId,
  orderIdsForGroup,
  summarizeOrderGroupMoney,
  summarizeOrderGroupStatus,
  ungroupedOrders,
  UNGROUPED_ORDER_GROUP_NAME,
} from "@/lib/orderGroups";
import { buildProcessingOrderSummary } from "@/lib/orderSummary";
import {
  buildOrderGroupSurchargeCsv,
  collectOrderGroupSurchargeCsvRows,
  listOrderRoleSurchargeDetails,
  summarizeRoleSurcharges,
  type RoleSurchargeSnapshotLine,
} from "@/lib/roleSurcharge";
import { EMPTY_ORDER_TRACKING } from "@/lib/tracking";
import { QUERY_KEYS } from "@/lib/constants";
import type { KitShareOrderContext } from "@/lib/kitOrderSummary";
import type { Tables } from "@/types/database";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function makeOrder(overrides: Partial<Tables<"orders">> = {}): Tables<"orders"> {
  const now = new Date().toISOString();
  return {
    id: "order-1",
    order_number: "CW-2026-000030",
    user_id: "user-1",
    cart_id: "cart-1",
    status: "processing",
    note: null,
    payment_method: null,
    telegram_username_snapshot: "PepQueen",
    shipping_delivery_method: null,
    shipping_first_name: null,
    shipping_last_name: null,
    shipping_street: null,
    shipping_house_number: null,
    shipping_address_extra: null,
    shipping_packstation_number: null,
    shipping_post_number: null,
    shipping_postal_code: null,
    shipping_city: null,
    shipping_country: null,
    total_usd: 100,
    total_eur: null,
    exchange_rate: 0.85,
    submitted_at: now,
    created_at: now,
    updated_at: now,
    china_shipping_amount: null,
    china_shipping_currency: null,
    de_shipping_amount: null,
    de_shipping_currency: null,
    ...EMPTY_ORDER_TRACKING,
    ...overrides,
    shop_area: overrides.shop_area ?? null,
  };
}

function makeItem(overrides: Partial<Tables<"order_items">> = {}): Tables<"order_items"> {
  return {
    id: "item-1",
    order_id: "order-1",
    position: 0,
    product_id: "prod-selank",
    product_code_snapshot: "SK10",
    product_name_snapshot: "Selank",
    dosage_vial_snapshot: "10mg",
    description_snapshot: null,
    normal_price_usd_snapshot: 30,
    bulk_price_usd_snapshot: null,
    bulk_price_min_quantity_snapshot: null,
    applied_price_tier: "normal",
    unit_price_usd_snapshot: 6,
    quantity: 5,
    line_total_usd: 30,
    exchange_rate_snapshot: null,
    eur_value_snapshot: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function snap(overrides: Partial<RoleSurchargeSnapshotLine> = {}): RoleSurchargeSnapshotLine {
  return {
    order_id: "order-1",
    order_item_id: "item-1",
    catalog_unit_price_usd: 16,
    selling_unit_price_usd: 20,
    quantity: 10,
    base_line_usd: 80,
    selling_line_usd: 100,
    surcharge_usd: 20,
    customer_role_name_snapshot: "Kunde",
    ...overrides,
  };
}

describe("persistent order group helpers", () => {
  it("creates a named group independently of date/status/customer", () => {
    const membership = membershipByOrderId([
      { order_id: "a", group_id: "g1" },
      { order_id: "b", group_id: "g1" },
    ]);
    expect(groupNameForOrder("a", membership, [{ id: "g1", name: "China Bestellung 10.09.2026" }])).toBe(
      "China Bestellung 10.09.2026",
    );
    expect(groupNameForOrder("z", membership, [{ id: "g1", name: "China Bestellung 10.09.2026" }])).toBe(
      UNGROUPED_ORDER_GROUP_NAME,
    );
  });

  it("assigns one or many orders to a group and never maps an order to two groups", () => {
    const rows = [
      { order_id: "a", group_id: "g1" },
      { order_id: "b", group_id: "g1" },
      { order_id: "c", group_id: "g2" },
    ];
    const membership = membershipByOrderId(rows);
    expect(membership.get("a")).toBe("g1");
    expect(membership.get("b")).toBe("g1");
    expect(orderIdsForGroup(rows, "g1")).toEqual(["a", "b"]);
    expect(membership.size).toBe(3);
  });

  it("moves an order by replacing its single membership", () => {
    const membership = membershipByOrderId([
      { order_id: "a", group_id: "g1" },
      { order_id: "a", group_id: "g2" },
    ]);
    expect(membership.get("a")).toBe("g2");
    expect(membership.size).toBe(1);
  });

  it("removes an order from a group and keeps it visible as ungrouped", () => {
    const orders = [makeOrder({ id: "a" }), makeOrder({ id: "b" })];
    const membership = membershipByOrderId([{ order_id: "a", group_id: "g1" }]);
    expect(ungroupedOrders(orders, membership).map((order) => order.id)).toEqual(["b"]);
    const afterRemove = membershipByOrderId([]);
    expect(ungroupedOrders(orders, afterRemove).map((order) => order.id)).toEqual(["a", "b"]);
  });

  it("deleting a group ungroups orders without dropping the order rows", () => {
    const orders = [makeOrder({ id: "a", order_number: "CW-2026-000030" })];
    const afterDelete = membershipByOrderId([]);
    expect(ungroupedOrders(orders, afterDelete)).toHaveLength(1);
    expect(orders[0]?.order_number).toBe("CW-2026-000030");
  });

  it("keeps groups after status changes because membership is independent of orders.status", () => {
    const orders = [
      makeOrder({ id: "a", status: "completed" }),
      makeOrder({ id: "b", status: "dispatched" }),
    ];
    const membership = membershipByOrderId([
      { order_id: "a", group_id: "g1" },
      { order_id: "b", group_id: "g1" },
    ]);
    expect(orderIdsForGroup(
      [...membership.entries()].map(([order_id, group_id]) => ({ order_id, group_id })),
      "g1",
    )).toHaveLength(2);
    expect(summarizeOrderGroupStatus(orders).total).toBe(2);
    expect(summarizeOrderGroupStatus(orders).label).toContain("Abgeschlossen");
    expect(summarizeOrderGroupMoney(orders).totalUsd).toBe(200);
    expect(countOrderItems([makeItem({ order_id: "a" }), makeItem({ id: "i2", order_id: "b" })], new Set(["a", "b"]))).toBe(2);
  });
});

describe("order summary uses all group members", () => {
  const kitId = "kit-selank";
  const productId = "prod-selank";
  const context: KitShareOrderContext = {
    kits: [{ id: kitId, product_id: productId, kit_size_vials: 10 }],
    participants: [
      { kit_share_id: kitId, user_id: "u1", quantity: 5, order_id: "a" },
      { kit_share_id: kitId, user_id: "u2", quantity: 5, order_id: "b" },
    ],
  };

  it("includes dispatched group orders and keeps kit aggregation on the existing SSoT", () => {
    const a = makeOrder({ id: "a", status: "dispatched", user_id: "u1", telegram_username_snapshot: "PepQueen" });
    const b = makeOrder({ id: "b", status: "completed", user_id: "u2", telegram_username_snapshot: "Penbuddy" });
    const items = [
      makeItem({ id: "i1", order_id: "a", product_id: productId, quantity: 5, line_total_usd: 30 }),
      makeItem({ id: "i2", order_id: "b", product_id: productId, quantity: 5, line_total_usd: 30 }),
    ];
    expect(buildProcessingOrderSummary([a, b], items, [], context).orderCount).toBe(0);
    const grouped = buildProcessingOrderSummary([a, b], items, [], context, new Set(["a", "b"]));
    expect(grouped.orderCount).toBe(2);
    expect(grouped.groups[0]?.lines[0]).toMatchObject({ code: "SK10", quantityLabel: "1 Kit" });
  });
});

describe("role surcharge aggregation per group", () => {
  it("sums frozen snapshots of current members only", () => {
    const orders = [
      makeOrder({ id: "a", total_usd: 100 }),
      makeOrder({ id: "b", total_usd: 80, telegram_username_snapshot: "Grill" }),
    ];
    const lines = [
      snap({ order_id: "a", surcharge_usd: 20, customer_role_name_snapshot: "Kunde" }),
      snap({
        order_id: "b",
        order_item_id: "item-2",
        surcharge_usd: 0,
        customer_role_name_snapshot: "PeptideGrill",
        base_line_usd: 80,
        selling_line_usd: 80,
      }),
    ];
    const withBoth = summarizeRoleSurcharges(lines, orders, ["a", "b"]);
    expect(withBoth.totalSurchargeUsd).toBe(20);
    expect(withBoth.byRole.map((row) => row.roleName)).toEqual(["Kunde", "PeptideGrill"]);

    const afterRemove = summarizeRoleSurcharges(lines, orders, ["b"]);
    expect(afterRemove.totalSurchargeUsd).toBe(0);
    expect(afterRemove.byRole).toEqual([
      expect.objectContaining({ roleName: "PeptideGrill", surchargeUsd: 0 }),
    ]);
  });

  it("does not recompute from a later role name", () => {
    const report = summarizeRoleSurcharges(
      [snap({ customer_role_name_snapshot: "Kunde", surcharge_usd: 28.25 })],
      [makeOrder({ id: "order-1", status: "completed" })],
      ["order-1"],
    );
    expect(report.totalSurchargeUsd).toBe(28.25);
    expect(report.byRole[0]?.roleName).toBe("Kunde");
    expect(listOrderRoleSurchargeDetails(
      [snap({ customer_role_name_snapshot: "Kunde", surcharge_usd: 28.25 })],
      [makeOrder({ id: "order-1" })],
      ["order-1"],
    )).toEqual([
      expect.objectContaining({ orderId: "order-1", roleName: "Kunde", surchargeUsd: 28.25 }),
    ]);
  });

  it("CSV includes group name and Nicht gruppiert without email", () => {
    const csv = buildOrderGroupSurchargeCsv(
      collectOrderGroupSurchargeCsvRows({
        groups: [{ id: "g1", name: "China Bestellung 10.09.2026" }],
        memberships: [{ group_id: "g1", order_id: "a" }],
        orders: [
          makeOrder({ id: "a", order_number: "CW-2026-000030" }),
          makeOrder({ id: "b", order_number: "CW-2026-000031", telegram_username_snapshot: "Grill" }),
        ],
        lines: [
          snap({ order_id: "a", surcharge_usd: 20 }),
          snap({ order_id: "b", order_item_id: "i2", surcharge_usd: 0, customer_role_name_snapshot: "PeptideGrill" }),
        ],
      }),
    );
    expect(csv).toContain("Bestellgruppe;Bestellnummer;Bestelldatum;Telegram Benutzername;Rolle;Aufschlag USD;Aufschlag EUR");
    expect(csv).toContain("China Bestellung 10.09.2026");
    expect(csv).toContain("CW-2026-000030");
    expect(csv).toContain(UNGROUPED_ORDER_GROUP_NAME);
    expect(csv).toContain("PepQueen");
    expect(csv).not.toMatch(/@/);
    expect(csv).not.toContain("email");
  });
});

describe("order group schema and admin-only access", () => {
  it("enforces unique order membership and admin RLS without touching orders rows", () => {
    const sql = read("supabase/migrations/0064_order_groups.sql");
    expect(sql).toContain("create table if not exists public.order_groups");
    expect(sql).toContain("create table if not exists public.order_group_orders");
    expect(sql).toMatch(/unique \(order_id\)/i);
    expect(sql).toContain("references public.order_groups (id) on delete cascade");
    expect(sql).toContain("references public.orders (id) on delete cascade");
    expect(sql).not.toMatch(/delete from public\.orders/i);
    expect(sql).not.toMatch(/update public\.orders/i);
    expect(sql).not.toMatch(/grant .* to anon/i);
    expect(sql.match(/has_role\(auth\.uid\(\), 'admin'\)/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).toContain("enable row level security");
  });

  it("keeps group data behind admin services/hooks and QUERY_KEYS", () => {
    expect(QUERY_KEYS.adminOrderGroups).toEqual(["admin-order-groups"]);
    expect(QUERY_KEYS.adminOrderGroupOrders).toEqual(["admin-order-group-orders"]);
    expect(read("src/hooks/useOrderGroups.ts")).toContain("QUERY_KEYS.adminOrderGroups");
    expect(read("src/services/orderGroups.ts")).toContain("from(\"order_groups\")");
    expect(read("src/pages/admin/AdminOrders.tsx")).toContain("AdminOrderGroups");
    expect(read("src/components/admin/AdminOrderGroups.tsx")).toContain("Zur Bestellgruppe hinzufügen");
    expect(read("src/pages/Orders.tsx")).not.toContain("useOrderGroups");
    expect(read("src/pages/OrderDetail.tsx")).not.toContain("useOrderGroups");
    expect(read("src/pages/admin/AdminOrders.tsx")).not.toContain("supabase.from");
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).not.toContain("supabase.from");
    expect(read("src/pages/admin/AdminRoleSurcharges.tsx")).not.toContain("supabase.from");
  });

  it("moves Rollenaufschläge under Bestellungen", () => {
    expect(read("src/lib/adminNav.ts")).toContain('to: "/admin/surcharges", label: "Rollenaufschläge"');
    expect(read("src/lib/adminNav.ts")).toContain("pathname.startsWith(\"/admin/surcharges\")");
  });

  it("keeps admin order list selection and ungrouped section without horizontal overflow wrappers", () => {
    const inbox = read("src/pages/admin/AdminOrders.tsx");
    expect(inbox).toContain('title="Nicht gruppiert"');
    expect(inbox).toContain("Checkbox");
    expect(inbox).toContain("overflow-x-hidden");
    expect(inbox).toContain("md:hidden");
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("overflow-x-hidden");
    expect(read("src/pages/admin/AdminRoleSurcharges.tsx")).toContain("overflow-x-hidden");
    expect(read("src/pages/admin/AdminRoleSurcharges.tsx")).toContain("buildOrderGroupSurchargeCsv");
  });
});

function thenable(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const method of ["select", "insert", "update", "delete", "eq", "in", "order", "single"]) {
    builder[method] = vi.fn(self);
  }
  (builder as { then: (resolve: (value: unknown) => unknown) => Promise<unknown> }).then = (resolve) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

describe("orderGroups service", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("creates, renames, assigns (move), removes, and deletes the group without deleting orders", async () => {
    const { assignOrdersToGroup, createOrderGroup, deleteOrderGroup, removeOrdersFromGroup, updateOrderGroup } =
      await import("@/services/orderGroups");

    const created = {
      id: "g1",
      name: "TEST Bestellgruppe",
      note: null,
      archived_at: null,
      created_at: "2026-09-10T00:00:00.000Z",
      updated_at: "2026-09-10T00:00:00.000Z",
      created_by: "admin-1",
    };
    from.mockImplementation((table: string) => {
      if (table === "order_groups") return thenable({ data: created, error: null });
      return thenable({ data: null, error: null });
    });

    await expect(createOrderGroup({ name: "TEST Bestellgruppe" })).resolves.toMatchObject({ name: "TEST Bestellgruppe" });
    await expect(updateOrderGroup("g1", { name: "China Order 01" })).resolves.toMatchObject({ id: "g1" });

    const tables: string[] = [];
    const ops: string[] = [];
    from.mockImplementation((table: string) => {
      tables.push(table);
      const builder = thenable({ data: null, error: null });
      (builder.delete as ReturnType<typeof vi.fn>).mockImplementation(() => {
        ops.push(`delete:${table}`);
        return builder;
      });
      (builder.insert as ReturnType<typeof vi.fn>).mockImplementation(() => {
        ops.push(`insert:${table}`);
        return builder;
      });
      return builder;
    });

    await assignOrdersToGroup("g1", ["a", "b", "a"]);
    expect(tables.every((table) => table === "order_group_orders")).toBe(true);
    expect(ops).toEqual(["delete:order_group_orders", "insert:order_group_orders"]);

    await removeOrdersFromGroup(["a"]);
    expect(ops).toContain("delete:order_group_orders");

    tables.length = 0;
    await deleteOrderGroup("g1");
    expect(tables).toEqual(["order_groups"]);
    expect(tables).not.toContain("orders");
    expect(tables).not.toContain("order_items");
  });
});

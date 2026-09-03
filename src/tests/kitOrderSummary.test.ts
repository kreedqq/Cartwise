import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSharedKitsForOrder, kitParticipantTelegramLabel } from "@/lib/kitOrderSummary";
import { buildProcessingOrderSummaryPdf, printProcessingOrderSummary } from "@/lib/orderExport";
import { buildProcessingOrderSummary } from "@/lib/orderSummary";
import { pdfContainsAscii, pdfStartsWithHeader } from "@/lib/pdfDocument";
import type { KitShareOrderContext } from "@/lib/kitOrderSummary";
import type { Tables } from "@/types/database";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function makeOrder(overrides: Partial<Tables<"orders">> = {}): Tables<"orders"> {
  const now = new Date().toISOString();
  return {
    id: "order-1",
    order_number: "CN-2026-000034",
    user_id: "user-pepsi",
    cart_id: "cart-1",
    status: "processing",
    note: null,
    payment_method: null,
    telegram_username_snapshot: "PepsiDry",
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
    total_usd: 0,
    total_eur: null,
    exchange_rate: null,
    submitted_at: now,
    created_at: now,
    updated_at: now,
    china_shipping_amount: null,
    china_shipping_currency: null,
    de_shipping_amount: null,
    de_shipping_currency: null,
    ...overrides,
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

function selankKitContext(overrides: Partial<KitShareOrderContext> = {}): KitShareOrderContext {
  return {
    kits: [{ id: "kit-10", product_id: "prod-selank", kit_size_vials: 10 }],
    participants: [
      { kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 5, order_id: "order-1" },
      { kit_share_id: "kit-10", user_id: "user-raff", quantity: 5, order_id: "order-2" },
    ],
    usernamesByUserId: { "user-pepsi": "PepsiDry", "user-raff": "Raff" },
    ...overrides,
  };
}

describe("shared kit order summary", () => {
  it("shows a processing share as 5/10 Stück and does not guess from the SKU", () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: "order-2",
        order_number: "CN-2026-000035",
        user_id: "user-raff",
        status: "pending",
        telegram_username_snapshot: "Raff",
      }),
    ];
    const items = [
      makeItem(),
      makeItem({ id: "item-2", order_id: "order-2", quantity: 5, line_total_usd: 30 }),
    ];
    const summary = buildProcessingOrderSummary(orders, items, [], selankKitContext());
    expect(summary.groups[0]?.lines).toHaveLength(1);
    expect(summary.groups[0]?.lines[0]).toMatchObject({
      code: "SK10",
      name: "Selank",
      quantityLabel: "5/10 Stück",
      totalUsd: 30,
    });
    expect(summary.customers.map((customer) => `${customer.heading} | ${customer.lines[0]?.quantityLabel}`)).toEqual([
      "CN-2026-000034 | PepsiDry | 5/10",
    ]);
  });

  it("does not count a cart-only or Eingegangen participant as processing", () => {
    const orders = [makeOrder()];
    const context = selankKitContext({
      participants: [
        { kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 5, order_id: "order-1" },
        { kit_share_id: "kit-10", user_id: "user-raff", quantity: 5, order_id: null },
      ],
    });
    const summary = buildProcessingOrderSummary(orders, [makeItem()], [], context);
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Stück");

    const pending = buildProcessingOrderSummary(
      [
        makeOrder(),
        makeOrder({
          id: "order-2",
          user_id: "user-raff",
          status: "pending",
          telegram_username_snapshot: "Raff",
        }),
      ],
      [makeItem(), makeItem({ id: "item-2", order_id: "order-2" })],
      [],
      selankKitContext(),
    );
    expect(pending.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Stück");
  });

  it("shows 1 Kit/s when both shares are In Bearbeitung", () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: "order-2",
        order_number: "CN-2026-000035",
        user_id: "user-raff",
        telegram_username_snapshot: "Raff",
      }),
    ];
    const items = [
      makeItem(),
      makeItem({ id: "item-2", order_id: "order-2", quantity: 5, line_total_usd: 30 }),
    ];
    const summary = buildProcessingOrderSummary(orders, items, [], selankKitContext());
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");
    expect(summary.groups[0]?.lines[0]?.totalUsd).toBe(60);
    expect(summary.customers.map((customer) => customer.lines[0]?.quantityLabel)).toEqual(["1 Kit/s", "1 Kit/s"]);
  });

  it("shows 2 Kit/s for two complete kits of the same variant", () => {
    const orders = [
      makeOrder({ id: "a" }),
      makeOrder({ id: "b", order_number: "CN-2026-000033" }),
    ];
    const items = [
      makeItem({ id: "ia", order_id: "a", quantity: 10, line_total_usd: 300 }),
      makeItem({ id: "ib", order_id: "b", quantity: 10, line_total_usd: 300 }),
    ];
    const context: KitShareOrderContext = {
      kits: [
        { id: "kit-a", product_id: "prod-selank", kit_size_vials: 10 },
        { id: "kit-b", product_id: "prod-selank", kit_size_vials: 10 },
      ],
      participants: [
        { kit_share_id: "kit-a", user_id: "user-pepsi", quantity: 10, order_id: "a" },
        { kit_share_id: "kit-b", user_id: "user-pepsi", quantity: 10, order_id: "b" },
      ],
    };
    const summary = buildProcessingOrderSummary(orders, items, [], context);
    expect(summary.groups[0]?.lines).toHaveLength(1);
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("2 Kit/s");
    expect(summary.groups[0]?.lines[0]?.totalUsd).toBe(600);
  });

  it("does not add 5+5 across different kit identities", () => {
    const orders = [
      makeOrder({ id: "a" }),
      makeOrder({ id: "b", order_number: "CN-2026-000033", telegram_username_snapshot: "Raff" }),
    ];
    const items = [
      makeItem({ id: "ia", order_id: "a" }),
      makeItem({ id: "ib", order_id: "b" }),
    ];
    const context: KitShareOrderContext = {
      kits: [
        { id: "kit-a", product_id: "prod-selank", kit_size_vials: 10 },
        { id: "kit-b", product_id: "prod-selank", kit_size_vials: 10 },
      ],
      participants: [
        { kit_share_id: "kit-a", user_id: "user-pepsi", quantity: 5, order_id: "a" },
        { kit_share_id: "kit-b", user_id: "user-raff", quantity: 5, order_id: "b" },
      ],
    };
    const summary = buildProcessingOrderSummary(orders, items, [], context);
    expect(summary.groups[0]?.lines).toHaveLength(2);
    expect(summary.groups[0]?.lines.every((line) => line.quantityLabel === "5/10 Stück")).toBe(true);
  });

  it("keeps different kit sizes and product variants separate", () => {
    const orders = [makeOrder({ id: "a" }), makeOrder({ id: "b", order_number: "CN-2026-000033" })];
    const items = [
      makeItem({ id: "ia", order_id: "a", quantity: 5, line_total_usd: 30 }),
      makeItem({
        id: "ib",
        order_id: "b",
        product_id: "prod-selank-20",
        product_code_snapshot: "SK20",
        product_name_snapshot: "Selank 20",
        quantity: 10,
        line_total_usd: 80,
      }),
    ];
    const context: KitShareOrderContext = {
      kits: [
        { id: "kit-10", product_id: "prod-selank", kit_size_vials: 10 },
        { id: "kit-20", product_id: "prod-selank-20", kit_size_vials: 20 },
      ],
      participants: [
        { kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 5, order_id: "a" },
        { kit_share_id: "kit-20", user_id: "user-pepsi", quantity: 10, order_id: "b" },
      ],
    };
    const summary = buildProcessingOrderSummary(orders, items, [], context);
    expect(summary.groups[0]?.lines.map((line) => `${line.code} ${line.quantityLabel}`)).toEqual([
      "SK10 5/10 Stück",
      "SK20 10/20 Stück",
    ]);
  });

  it("updates kit progress when a participant order moves to processing", () => {
    const pepsi = makeOrder();
    const raffPending = makeOrder({
      id: "order-2",
      order_number: "CN-2026-000035",
      user_id: "user-raff",
      status: "pending",
      telegram_username_snapshot: "Raff",
    });
    const items = [makeItem(), makeItem({ id: "item-2", order_id: "order-2" })];
    const before = buildProcessingOrderSummary([pepsi, raffPending], items, [], selankKitContext());
    expect(before.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Stück");
    const after = buildProcessingOrderSummary(
      [pepsi, { ...raffPending, status: "processing" }],
      items,
      [],
      selankKitContext(),
    );
    expect(after.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");
  });

  it("uses stored line_total_usd and never a 25 percent formula", () => {
    const source = read("src/lib/orderSummary.ts") + read("src/lib/kitOrderSummary.ts") + read("src/lib/orderExport.ts");
    expect(source).not.toContain("1.25");
    expect(source).not.toContain("* 1.25");
    const summary = buildProcessingOrderSummary([makeOrder()], [makeItem({ line_total_usd: 30 })], [], selankKitContext());
    expect(summary.groups[0]?.lines[0]?.totalUsd).toBe(30);
  });
});

describe("admin shared kit participants", () => {
  it("lists telegram snapshots, shares, and statuses for the current order", () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: "order-2",
        order_number: "CN-2026-000035",
        user_id: "user-raff",
        status: "pending",
        telegram_username_snapshot: "Raff",
      }),
    ];
    const views = buildSharedKitsForOrder("order-1", [makeItem()], orders, selankKitContext());
    expect(views).toHaveLength(1);
    expect(views[0]?.kitSize).toBe(10);
    expect(views[0]?.progressLabel).toBe("5/10 bestellt");
    expect(views[0]?.complete).toBe(false);
    expect(views[0]?.participants.map((participant) => `${participant.telegramLabel}|${participant.shareLabel}|${participant.statusLabel}|${participant.isCurrentOrder}`)).toEqual([
      "PepsiDry|5/10|In Bearbeitung|true",
      "Raff|5/10|Eingegangen|false",
    ]);
  });

  it("marks a kit complete only after both orders are processing", () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: "order-2",
        user_id: "user-raff",
        telegram_username_snapshot: "Raff",
      }),
    ];
    const views = buildSharedKitsForOrder("order-1", [makeItem()], orders, selankKitContext());
    expect(views[0]?.progressLabel).toBe("10/10 bestellt");
    expect(views[0]?.complete).toBe(true);
  });

  it("uses the order snapshot and never display_name", () => {
    expect(
      kitParticipantTelegramLabel({
        order: { telegram_username_snapshot: "PepsiDry" },
        profileUsername: "LiveName",
      }),
    ).toBe("PepsiDry");
    expect(
      kitParticipantTelegramLabel({
        order: { telegram_username_snapshot: null },
        profileUsername: "LiveName",
      }),
    ).toBe("Nicht verfügbar");
    expect(kitParticipantTelegramLabel({ profileUsername: "Raff" })).toBe("Raff");
    expect(kitParticipantTelegramLabel({})).toBe("Nicht verfügbar");
    expect(read("src/lib/kitOrderSummary.ts")).not.toContain("display_name");
    expect(read("src/components/orders/SharedKitAdminCard.tsx")).not.toContain("display_name");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("Geteiltes Kit");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("buildSharedKitsForOrder");
    expect(read("src/pages/OrderDetail.tsx")).not.toContain("Geteiltes Kit");
    expect(read("src/pages/OrderDetail.tsx")).not.toContain("listAdminKitOrderContext");
    expect(read("src/pages/Orders.tsx")).not.toContain("listAdminKitOrderContext");
  });
});

describe("order summary PDF download", () => {
  it("writes a real PDF with kit shares, order numbers, and telegram snapshots", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder()],
      [makeItem()],
      [{ id: "prod-selank", code: "SK10", name: "Selank", category: "PEPTIDES" }],
      selankKitContext({
        participants: [{ kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 5, order_id: "order-1" }],
      }),
    );
    const bytes = buildProcessingOrderSummaryPdf(summary, "now");
    expect(pdfStartsWithHeader(bytes)).toBe(true);
    expect(pdfContainsAscii(bytes, "SK10")).toBe(true);
    expect(pdfContainsAscii(bytes, "5/10")).toBe(true);
    expect(pdfContainsAscii(bytes, "CN-2026-000034")).toBe(true);
    expect(pdfContainsAscii(bytes, "PepsiDry")).toBe(true);
    expect(pdfContainsAscii(bytes, "30,00")).toBe(true);
    expect(new TextDecoder("latin1").decode(bytes)).not.toContain("display_name");
  });

  it("triggers a browser file download for a non-empty summary", () => {
    const clicks: string[] = [];
    const createElement = document.createElement.bind(document);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const el = createElement(tag);
      if (tag === "a") {
        const anchor = el as HTMLAnchorElement;
        anchor.click = () => clicks.push(anchor.download);
        return anchor;
      }
      return el;
    }) as typeof document.createElement);
    const bytes = printProcessingOrderSummary(
      buildProcessingOrderSummary([makeOrder()], [makeItem({ quantity: 1, line_total_usd: 10 })]),
      "now",
    );
    expect(bytes).not.toBeNull();
    expect(bytes && pdfStartsWithHeader(bytes)).toBe(true);
    expect(clicks).toEqual(["Bestell-Zusammenfassung.pdf"]);
  });
});

describe("kit query invalidation and admin isolation", () => {
  it("invalidates kit context when an admin changes order status", () => {
    const hooks = read("src/hooks/useOrders.ts");
    expect(hooks).toContain("QUERY_KEYS.adminKitOrderContext");
    expect(hooks).toContain("QUERY_KEYS.adminOrderItems");
    expect(hooks).toContain("QUERY_KEYS.adminOrders");
  });

  it("loads kit context only in admin order surfaces", () => {
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("useAdminKitOrderContext");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("useAdminKitOrderContext");
    expect(read("src/pages/Orders.tsx")).not.toContain("useAdminKitOrderContext");
    expect(read("src/pages/OrderDetail.tsx")).not.toContain("useAdminKitOrderContext");
    expect(read("src/services/kitOrderContext.ts")).toContain('from("kit_shares")');
    expect(read("src/services/kitOrderContext.ts")).toContain("username");
    expect(read("src/services/kitOrderContext.ts")).not.toContain("display_name");
  });
});

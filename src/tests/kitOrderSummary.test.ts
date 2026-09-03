import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  asQuantity,
  buildSharedKitsForOrder,
  kitParticipantTelegramLabel,
  splitKitProgress,
} from "@/lib/kitOrderSummary";
import { buildProcessingOrderSummaryPdf, printProcessingOrderSummary } from "@/lib/orderSummaryExport";
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
    expect(summary.personLines[0]?.quantityLabel).toBe("5/10");
    expect(summary.personLines[0]?.name).toBe("PepsiDry");

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
    expect(summary.personLines.map((line) => `${line.name}|${line.quantityLabel}`).sort()).toEqual([
      "PepsiDry|5/10",
      "Raff|5/10",
    ]);
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

  it("keeps a partial kit and a complete kit of the same SKU as two lines", () => {
    const orders = [
      makeOrder({ id: "partial-a" }),
      makeOrder({ id: "complete-b", order_number: "CN-2026-000033" }),
    ];
    const items = [
      makeItem({ id: "ia", order_id: "partial-a", quantity: 5, line_total_usd: 30 }),
      makeItem({ id: "ib", order_id: "complete-b", quantity: 10, line_total_usd: 60 }),
    ];
    const context: KitShareOrderContext = {
      kits: [
        { id: "kit-partial", product_id: "prod-selank", kit_size_vials: 10 },
        { id: "kit-complete", product_id: "prod-selank", kit_size_vials: 10 },
      ],
      participants: [
        { kit_share_id: "kit-partial", user_id: "user-pepsi", quantity: 5, order_id: "partial-a" },
        { kit_share_id: "kit-complete", user_id: "user-pepsi", quantity: 10, order_id: "complete-b" },
      ],
    };
    const summary = buildProcessingOrderSummary(orders, items, [], context);
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel).sort()).toEqual(["1 Kit/s", "5/10 Stück"]);
    expect(summary.groups[0]?.lines.reduce((sum, line) => sum + line.totalUsd, 0)).toBe(90);
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

describe("kit vial aggregation regressions", () => {
  it("counts complete kits as floor(vials / kit_size_vials), never the vial quantity", () => {
    expect(splitKitProgress(5, 10)).toEqual({ completeKits: 0, remainderVials: 5 });
    expect(splitKitProgress(10, 10)).toEqual({ completeKits: 1, remainderVials: 0 });
    expect(splitKitProgress(15, 10)).toEqual({ completeKits: 1, remainderVials: 5 });
    expect(splitKitProgress(20, 10)).toEqual({ completeKits: 2, remainderVials: 0 });
    expect(splitKitProgress(10, 20)).toEqual({ completeKits: 0, remainderVials: 10 });
    expect(splitKitProgress(15, 30)).toEqual({ completeKits: 0, remainderVials: 15 });
    expect(asQuantity("5.000")).toBe(5);
    expect(read("src/lib/orderSummary.ts")).not.toContain("formatCompleteKitQuantityLabel(item.quantity)");
    expect(read("src/lib/orderSummary.ts")).not.toContain("formatCompleteKitQuantityLabel(progress.processingQuantity)");
  });

  it("TEST 1: 5+5 processing vials of a 10er kit are 1 Kit/s, not 5 or 10 kits", () => {
    const orders = [
      makeOrder(),
      makeOrder({ id: "order-2", order_number: "CN-2026-000035", user_id: "user-raff", telegram_username_snapshot: "Raff" }),
    ];
    const items = [makeItem(), makeItem({ id: "item-2", order_id: "order-2", quantity: 5, line_total_usd: 30 })];
    const summary = buildProcessingOrderSummary(orders, items, [], selankKitContext());
    expect(summary.groups[0]?.lines).toHaveLength(1);
    expect(summary.groups[0]?.lines[0]?.quantity).toBe(1);
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel)).not.toContain("5 Kit/s");
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel)).not.toContain("10 Kit/s");
  });

  it("TEST 2: only participant A = 5 processing stays 5/10 Stück", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder()],
      [makeItem()],
      [],
      selankKitContext({
        participants: [{ kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 5, order_id: "order-1" }],
      }),
    );
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Stück");
  });

  it("TEST 3: A processing and B not processing stays 5/10 Stück", () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: "order-2",
        user_id: "user-raff",
        status: "pending",
        telegram_username_snapshot: "Raff",
      }),
    ];
    const summary = buildProcessingOrderSummary(
      orders,
      [makeItem(), makeItem({ id: "item-2", order_id: "order-2" })],
      [],
      selankKitContext(),
    );
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Stück");
  });

  it("TEST 4: both processing becomes 1 Kit/s", () => {
    const orders = [
      makeOrder(),
      makeOrder({ id: "order-2", user_id: "user-raff", telegram_username_snapshot: "Raff" }),
    ];
    const summary = buildProcessingOrderSummary(
      orders,
      [makeItem(), makeItem({ id: "item-2", order_id: "order-2" })],
      [],
      selankKitContext(),
    );
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");
  });

  it("TEST 5: a single processing 10-vial share is 1 Kit/s", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder()],
      [makeItem({ quantity: 10, line_total_usd: 60 })],
      [],
      selankKitContext({
        participants: [{ kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 10, order_id: "order-1" }],
      }),
    );
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");
  });

  it("TEST 6: two complete 10er kits are 2 Kit/s", () => {
    const orders = [makeOrder({ id: "a" }), makeOrder({ id: "b", order_number: "CN-2026-000033" })];
    const items = [
      makeItem({ id: "ia", order_id: "a", quantity: 10, line_total_usd: 60 }),
      makeItem({ id: "ib", order_id: "b", quantity: 10, line_total_usd: 60 }),
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
    expect(buildProcessingOrderSummary(orders, items, [], context).groups[0]?.lines[0]?.quantityLabel).toBe("2 Kit/s");
  });

  it("TEST 6b: 5+5+5+5 of the same kit identity is 2 Kit/s", () => {
    const orders = ["a", "b", "c", "d"].map((id, index) =>
      makeOrder({ id, order_number: `CN-2026-00000${index}`, user_id: `user-${id}` }),
    );
    const items = orders.map((order, index) =>
      makeItem({ id: `item-${index}`, order_id: order.id, quantity: 5, line_total_usd: 30 }),
    );
    const context: KitShareOrderContext = {
      kits: [{ id: "kit-20", product_id: "prod-selank", kit_size_vials: 10 }],
      participants: orders.map((order) => ({
        kit_share_id: "kit-20",
        user_id: order.user_id ?? order.id,
        quantity: 5,
        order_id: order.id,
      })),
    };
    const summary = buildProcessingOrderSummary(orders, items, [], context);
    expect(summary.groups[0]?.lines).toHaveLength(1);
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("2 Kit/s");
  });

  it("TEST 7: different kit_share_id stay two 5/10 lines", () => {
    const orders = [
      makeOrder({ id: "a" }),
      makeOrder({ id: "b", order_number: "CN-2026-000033", telegram_username_snapshot: "Raff" }),
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
    const summary = buildProcessingOrderSummary(
      orders,
      [makeItem({ id: "ia", order_id: "a" }), makeItem({ id: "ib", order_id: "b" })],
      [],
      context,
    );
    expect(summary.groups[0]?.lines).toHaveLength(2);
    expect(summary.groups[0]?.lines.every((line) => line.quantityLabel === "5/10 Stück")).toBe(true);
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel)).not.toContain("1 Kit/s");
  });

  it("TEST 8: a normal product without kit identity stays 5+3=8", () => {
    const orders = [makeOrder({ id: "a" }), makeOrder({ id: "b", order_number: "CN-2026-000033" })];
    const items = [
      makeItem({ id: "ia", order_id: "a", quantity: 5, line_total_usd: 50 }),
      makeItem({ id: "ib", order_id: "b", quantity: 3, line_total_usd: 30 }),
    ];
    const summary = buildProcessingOrderSummary(orders, items);
    expect(summary.groups[0]?.lines).toHaveLength(1);
    expect(summary.groups[0]?.lines[0]?.quantity).toBe(8);
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("8");
    expect(summary.groups[0]?.lines[0]?.quantityLabel).not.toContain("Kit/s");
    expect(summary.groups[0]?.lines[0]?.quantityLabel).not.toContain("/");
  });

  it("TEST 9: PDF MENGE uses the same 1 Kit/s label as the web summary", () => {
    const orders = [
      makeOrder(),
      makeOrder({ id: "order-2", order_number: "CN-2026-000035", user_id: "user-raff", telegram_username_snapshot: "Raff" }),
    ];
    const items = [makeItem(), makeItem({ id: "item-2", order_id: "order-2", quantity: 5, line_total_usd: 30 })];
    const summary = buildProcessingOrderSummary(
      orders,
      items,
      [{ id: "prod-selank", code: "SK10", name: "Selank", category: "PEPTIDES" }],
      selankKitContext(),
    );
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");
    const bytes = buildProcessingOrderSummaryPdf(summary, "now");
    expect(pdfContainsAscii(bytes, "1 Kit/s")).toBe(true);
    expect(pdfContainsAscii(bytes, "5 Kit/s")).toBe(false);
    expect(pdfContainsAscii(bytes, "10 Kit/s")).toBe(false);
    expect(summary.personLines.map((line) => line.quantityLabel).sort()).toEqual(["5/10", "5/10"]);
  });

  it("keeps 15 vials of size 10 as 1 Kit/s plus 5/10 Stück", () => {
    const orders = ["a", "b", "c"].map((id, index) =>
      makeOrder({ id, order_number: `CN-2026-00000${index}`, user_id: `user-${id}` }),
    );
    const items = orders.map((order, index) =>
      makeItem({ id: `item-${index}`, order_id: order.id, quantity: 5, line_total_usd: 30 }),
    );
    const context: KitShareOrderContext = {
      kits: [{ id: "kit-15", product_id: "prod-selank", kit_size_vials: 10 }],
      participants: orders.map((order) => ({
        kit_share_id: "kit-15",
        user_id: order.user_id ?? order.id,
        quantity: 5,
        order_id: order.id,
      })),
    };
    const summary = buildProcessingOrderSummary(orders, items, [], context);
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel).sort()).toEqual(["1 Kit/s", "5/10 Stück"]);
    expect(summary.groups[0]?.lines.reduce((sum, line) => sum + line.totalUsd, 0)).toBe(90);
  });

  it("uses kit_size_vials for 10+10 of a 20er kit and 15+15 of a 30er kit", () => {
    const twenty = buildProcessingOrderSummary(
      [makeOrder({ id: "a" }), makeOrder({ id: "b", order_number: "CN-2026-000033" })],
      [
        makeItem({ id: "ia", order_id: "a", quantity: 10, line_total_usd: 40 }),
        makeItem({ id: "ib", order_id: "b", quantity: 10, line_total_usd: 40 }),
      ],
      [],
      {
        kits: [{ id: "kit-20", product_id: "prod-selank", kit_size_vials: 20 }],
        participants: [
          { kit_share_id: "kit-20", user_id: "user-pepsi", quantity: 10, order_id: "a" },
          { kit_share_id: "kit-20", user_id: "user-raff", quantity: 10, order_id: "b" },
        ],
      },
    );
    expect(twenty.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");

    const thirty = buildProcessingOrderSummary(
      [makeOrder({ id: "a" }), makeOrder({ id: "b", order_number: "CN-2026-000033" })],
      [
        makeItem({ id: "ia", order_id: "a", quantity: 15, line_total_usd: 45 }),
        makeItem({ id: "ib", order_id: "b", quantity: 15, line_total_usd: 45 }),
      ],
      [],
      {
        kits: [{ id: "kit-30", product_id: "prod-selank", kit_size_vials: 30 }],
        participants: [
          { kit_share_id: "kit-30", user_id: "user-pepsi", quantity: 15, order_id: "a" },
          { kit_share_id: "kit-30", user_id: "user-raff", quantity: 15, order_id: "b" },
        ],
      },
    );
    expect(thirty.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit/s");
  });

  it("does not treat Postgres numeric 5.000 as 5 kits, including two kits on one order", () => {
    const qty = "5.000" as unknown as number;
    const orders = [
      makeOrder({ id: "order-30", user_id: "user-a", cart_id: "cart-a" }),
      makeOrder({ id: "order-36", order_number: "CN-2026-000036", user_id: "user-b", cart_id: "cart-b" }),
    ];
    const items = [
      makeItem({ id: "selank-30", order_id: "order-30", quantity: qty, line_total_usd: 30 }),
      makeItem({
        id: "semax-30",
        order_id: "order-30",
        product_id: "prod-semax",
        product_code_snapshot: "XA10",
        product_name_snapshot: "Semax",
        quantity: qty,
        line_total_usd: 27.5,
      }),
      makeItem({ id: "selank-36", order_id: "order-36", quantity: qty, line_total_usd: 30 }),
      makeItem({
        id: "semax-36",
        order_id: "order-36",
        product_id: "prod-semax",
        product_code_snapshot: "XA10",
        product_name_snapshot: "Semax",
        quantity: qty,
        line_total_usd: 27.5,
      }),
    ];
    const context: KitShareOrderContext = {
      kits: [
        { id: "kit-selank", product_id: "prod-selank", kit_size_vials: 10 },
        { id: "kit-semax", product_id: "prod-semax", kit_size_vials: 10 },
      ],
      participants: [
        { kit_share_id: "kit-selank", user_id: "user-a", quantity: 5, order_id: "order-30" },
        { kit_share_id: "kit-selank", user_id: "user-b", quantity: 5, order_id: "order-36" },
        { kit_share_id: "kit-semax", user_id: "user-a", quantity: 5, order_id: "order-30" },
        { kit_share_id: "kit-semax", user_id: "user-b", quantity: 5, order_id: "order-36" },
      ],
    };
    const summary = buildProcessingOrderSummary(orders, items, [], context);
    expect(summary.groups[0]?.lines.map((line) => `${line.code} ${line.quantityLabel}`).sort()).toEqual([
      "SK10 1 Kit/s",
      "XA10 1 Kit/s",
    ]);
    expect(buildProcessingOrderSummary(orders, items, [], undefined).groups.length).toBeGreaterThan(0);
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
    expect(pdfContainsAscii(bytes, "PepsiDry")).toBe(true);
    expect(pdfContainsAscii(bytes, "30,00")).toBe(true);
    expect(pdfContainsAscii(bytes, "PEPTIDE")).toBe(true);
    expect(pdfContainsAscii(bytes, "INJECTABLE OILS")).toBe(true);
    expect(pdfContainsAscii(bytes, "ORALS")).toBe(true);
    expect(pdfContainsAscii(bytes, "BESTELLUNGEN")).toBe(true);
    expect(pdfContainsAscii(bytes, "CODE")).toBe(true);
    expect(pdfContainsAscii(bytes, "NAME")).toBe(true);
    expect(pdfContainsAscii(bytes, "DOSIS")).toBe(true);
    expect(summary.customers[0]?.orderNumber).toBe("CN-2026-000034");
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

  it("disables PDF export when the summary has no processing orders", () => {
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("Name");
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("Dosis");
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("Wer hat was bestellt und in welcher Menge");
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("downloadProcessingOrderSummaryPdf");
    expect(read("src/lib/orderSummaryExport.ts")).toContain('downloadPdf("Bestell-Zusammenfassung.pdf"');
    expect(read("src/lib/orderSummaryExport.ts")).not.toContain("window.print");
    const empty = buildProcessingOrderSummary([], [], []);
    expect(empty.orderCount).toBe(0);
    expect(printProcessingOrderSummary(empty, "now")).toBeNull();
  });

  it("splits a long merchant list across PDF pages without dropping SKUs", () => {
    const orders = Array.from({ length: 40 }, (_, index) =>
      makeOrder({
        id: `order-${index}`,
        order_number: `CN-2026-${String(index).padStart(6, "0")}`,
        telegram_username_snapshot: `User${index}`,
      }),
    );
    const items = orders.map((order, index) =>
      makeItem({
        id: `item-${index}`,
        order_id: order.id,
        product_id: `prod-${index}`,
        product_code_snapshot: `SKU${index}`,
        product_name_snapshot: `Artikel mit sehr langem Namen Nummer ${index}`,
        quantity: 1,
        line_total_usd: 10,
      }),
    );
    const bytes = buildProcessingOrderSummaryPdf(
      buildProcessingOrderSummary(orders, items, items.map((item) => ({
        id: item.product_id,
        code: item.product_code_snapshot,
        name: item.product_name_snapshot,
        category: "PEPTIDES",
      }))),
      "now",
    );
    const text = new TextDecoder("latin1").decode(bytes);
    expect(pdfStartsWithHeader(bytes)).toBe(true);
    expect((text.match(/\/Type \/Page/g) ?? []).length).toBeGreaterThan(1);
    expect(text).toContain("SKU0");
    expect(text).toContain("SKU39");
    expect(text).toContain("User39");
    expect(text).toContain("PEPTIDE");
    expect(text).toContain("BESTELLUNGEN");
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
    expect(read("src/services/kitOrderContext.ts")).toContain("kit_size_vials");
    expect(read("src/services/kitOrderContext.ts")).toContain("order_id");
    expect(read("src/services/kitOrderContext.ts")).toContain("username");
    expect(read("src/services/kitOrderContext.ts")).not.toContain("display_name");
    const rlsFix = read("supabase/migrations/0048_fix_kit_share_participants_rls_recursion.sql");
    expect(rlsFix).toContain("user_participates_in_kit_share");
    expect(rlsFix).toContain("security definer");
    expect(rlsFix).toContain("infinite recursion");
    expect(rlsFix).toContain("kit_share_participants_select_same_kit");
    expect(rlsFix).not.toContain("drop policy if exists \"kit_shares_select_admin\"");
    expect(rlsFix).not.toContain("drop policy if exists \"kit_share_participants_select_admin\"");
  });
});

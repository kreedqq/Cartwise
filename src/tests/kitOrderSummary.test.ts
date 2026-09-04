import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  asQuantity,
  buildSharedKitsForOrder,
  formatCompleteKitQuantityLabel,
  kitParticipantTelegramLabel,
  splitKitProgress,
} from "@/lib/kitOrderSummary";
import { buildProcessingOrderSummaryPdf, printProcessingOrderSummary } from "@/lib/orderSummaryExport";
import { buildProcessingOrderSummary } from "@/lib/orderSummary";
import { pdfContainsAscii, pdfStartsWithHeader } from "@/lib/pdfDocument";
import { EMPTY_ORDER_TRACKING } from "@/lib/tracking";
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
    ...EMPTY_ORDER_TRACKING,
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

function makeOilItem(overrides: Partial<Tables<"order_items">> = {}): Tables<"order_items"> {
  return makeItem({
    id: "oil-1",
    product_id: "prod-te300",
    product_code_snapshot: "TE300",
    product_name_snapshot: "TEST ENANTHATE",
    dosage_vial_snapshot: "300mg/ml",
    quantity: 5,
    line_total_usd: 85,
    ...overrides,
  });
}

const oilCatalog = [{ id: "prod-te300", code: "TE300", name: "TEST ENANTHATE", category: "INJECTABLES-OILS" }];

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

/** Production kit identities. Replay only — tests never write live order status. */
const LIVE_SELANK_ID = "4c3de824-f70b-4cc4-8786-4293316d0fc1";
const LIVE_SEMAX_ID = "ffc0afc4-d984-41c0-96f4-b3c441e8ac2b";
const LIVE_TE300_ID = "a1ebe3d9-9c6e-4e1c-9146-0365f6ca2a61";
const LIVE_KIT_SELANK = "42235edd-5dac-4468-a119-e7eae1dde2dd";
const LIVE_KIT_SEMAX = "d3f1c575-ca5d-406c-a169-5ba56dec75f8";
const LIVE_QTY = "5.000" as unknown as number;

function livePenbuddyPepQueenReplay(
  pepQueenStatus: Tables<"orders">["status"] = "processing",
  penbuddyStatus: Tables<"orders">["status"] = "processing",
) {
  const pepQueen = makeOrder({
    id: "5539b116-bc33-4c63-9535-3a97cfe84dc4",
    order_number: "CW-2026-000030",
    user_id: "f6df0375-5d24-4ad4-b8b2-efcc6fd0b5f2",
    cart_id: "f8673972-9403-4701-be72-aa3850ba0870",
    telegram_username_snapshot: "PepQueen",
    status: pepQueenStatus,
  });
  const penbuddy = makeOrder({
    id: "7b02ae6e-25b8-4f7f-999d-5557e0931445",
    order_number: "CW-2026-000036",
    user_id: "641e5d33-177a-4b7e-ac31-47e40ffb1cc7",
    cart_id: "a042b1df-cb53-4f02-9cdc-6461b91a2569",
    telegram_username_snapshot: "Penbuddy",
    status: penbuddyStatus,
  });
  const pepsi = makeOrder({
    id: "224ff4ce-38ae-41b8-8b0c-a68ba7cc5e07",
    order_number: "CW-2026-000034",
    user_id: "f0dc82df-7f75-4838-86c6-1e7161c7fa7b",
    cart_id: "6a2c7296-6ee2-4154-be76-0c840b7657b7",
    telegram_username_snapshot: "PepsiDry",
    status: "processing",
  });
  const items = [
    makeItem({
      id: "4f6d2b73-e99b-4ed5-afc0-f378ffcb04ce",
      order_id: pepQueen.id,
      product_id: LIVE_SELANK_ID,
      dosage_vial_snapshot: "10mg/vial x10vials",
      quantity: LIVE_QTY,
      line_total_usd: 30,
    }),
    makeItem({
      id: "38392aca-3602-42b7-814c-b33d17adb580",
      order_id: pepQueen.id,
      product_id: LIVE_SEMAX_ID,
      product_code_snapshot: "XA10",
      product_name_snapshot: "Semax",
      dosage_vial_snapshot: "10mg/vial x10vials",
      quantity: LIVE_QTY,
      line_total_usd: 27.5,
    }),
    makeItem({
      id: "6c8ed1ae-75a9-4f37-9031-96ff70c42a33",
      order_id: penbuddy.id,
      product_id: LIVE_SELANK_ID,
      dosage_vial_snapshot: "10mg/vial x10vials",
      quantity: LIVE_QTY,
      line_total_usd: 30,
    }),
    makeItem({
      id: "7bed61da-06b1-4538-b21c-a84ab4465e80",
      order_id: penbuddy.id,
      product_id: LIVE_SEMAX_ID,
      product_code_snapshot: "XA10",
      product_name_snapshot: "Semax",
      dosage_vial_snapshot: "10mg/vial x10vials",
      quantity: LIVE_QTY,
      line_total_usd: 27.5,
    }),
    makeOilItem({
      id: "98133866-e21c-4c11-ae0a-43bbc89f609b",
      order_id: pepsi.id,
      product_id: LIVE_TE300_ID,
      dosage_vial_snapshot: "300mg",
      quantity: LIVE_QTY,
      line_total_usd: 85,
    }),
  ];
  const catalog = [
    { id: LIVE_SELANK_ID, code: "SK10", name: "Selank", category: "PEPTIDES", dosage_vial: "10mg/vial x10vials" },
    { id: LIVE_SEMAX_ID, code: "XA10", name: "Semax", category: "PEPTIDES", dosage_vial: "10mg/vial x10vials" },
    { id: LIVE_TE300_ID, code: "TE300", name: "TEST ENANTHATE", category: "INJECTABLES-OILS", dosage_vial: "300mg" },
  ];
  const context: KitShareOrderContext = {
    kits: [
      { id: LIVE_KIT_SELANK, product_id: LIVE_SELANK_ID, kit_size_vials: 10 },
      { id: LIVE_KIT_SEMAX, product_id: LIVE_SEMAX_ID, kit_size_vials: 10 },
    ],
    participants: [
      { kit_share_id: LIVE_KIT_SELANK, user_id: pepQueen.user_id as string, quantity: 5, order_id: pepQueen.id },
      { kit_share_id: LIVE_KIT_SELANK, user_id: penbuddy.user_id as string, quantity: 5, order_id: penbuddy.id },
      { kit_share_id: LIVE_KIT_SEMAX, user_id: pepQueen.user_id as string, quantity: 5, order_id: pepQueen.id },
      { kit_share_id: LIVE_KIT_SEMAX, user_id: penbuddy.user_id as string, quantity: 5, order_id: penbuddy.id },
    ],
    cartLinks: [
      { cart_id: pepQueen.cart_id as string, kit_share_id: LIVE_KIT_SELANK, product_id: LIVE_SELANK_ID, quantity: 5 },
      { cart_id: pepQueen.cart_id as string, kit_share_id: LIVE_KIT_SEMAX, product_id: LIVE_SEMAX_ID, quantity: 5 },
      { cart_id: penbuddy.cart_id as string, kit_share_id: LIVE_KIT_SELANK, product_id: LIVE_SELANK_ID, quantity: 5 },
      { cart_id: penbuddy.cart_id as string, kit_share_id: LIVE_KIT_SEMAX, product_id: LIVE_SEMAX_ID, quantity: 5 },
    ],
  };
  return { pepQueen, penbuddy, pepsi, items, catalog, context };
}

describe("shared kit order summary", () => {
  it("shows a processing share as 5/10 Kit and does not guess from the SKU", () => {
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
      quantityLabel: "5/10 Kit",
      totalUsd: 30,
    });
    expect(summary.customers.map((customer) => `${customer.heading} | ${customer.lines[0]?.quantityLabel}`)).toEqual([
      "CN-2026-000034 | PepsiDry | 5/10 Kit",
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Kit");
    expect(summary.personLines[0]?.quantityLabel).toBe("5/10 Kit");
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
    expect(pending.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Kit");
  });

  it("shows 1 Kit when both shares are In Bearbeitung", () => {
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");
    expect(summary.personLines.map((line) => `${line.name}|${line.quantityLabel}`).sort()).toEqual([
      "PepsiDry + Raff|1 Kit",
    ]);
    expect(summary.groups[0]?.lines[0]?.totalUsd).toBe(60);
    expect(summary.customers.map((customer) => customer.lines[0]?.quantityLabel)).toEqual(["5/10 Kit", "5/10 Kit"]);
  });

  it("shows 2 Kits for two complete kits of the same variant", () => {
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("2 Kits");
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
    expect(summary.groups[0]?.lines.every((line) => line.quantityLabel === "5/10 Kit")).toBe(true);
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
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel).sort()).toEqual(["1 Kit", "5/10 Kit"]);
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
      "SK10 5/10 Kit",
      "SK20 10/20 Kit",
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
    expect(before.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Kit");
    const after = buildProcessingOrderSummary(
      [pepsi, { ...raffPending, status: "processing" }],
      items,
      [],
      selankKitContext(),
    );
    expect(after.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");
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

  it("TEST 1: 5+5 processing vials of a 10er kit are 1 Kit, not 5 or 10 kits", () => {
    const orders = [
      makeOrder(),
      makeOrder({ id: "order-2", order_number: "CN-2026-000035", user_id: "user-raff", telegram_username_snapshot: "Raff" }),
    ];
    const items = [makeItem(), makeItem({ id: "item-2", order_id: "order-2", quantity: 5, line_total_usd: 30 })];
    const summary = buildProcessingOrderSummary(orders, items, [], selankKitContext());
    expect(summary.groups[0]?.lines).toHaveLength(1);
    expect(summary.groups[0]?.lines[0]?.quantity).toBe(1);
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel)).not.toContain("5 Kits");
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel)).not.toContain("10 Kits");
  });

  it("TEST 2: only participant A = 5 processing stays 5/10 Kit", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder()],
      [makeItem()],
      [],
      selankKitContext({
        participants: [{ kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 5, order_id: "order-1" }],
      }),
    );
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Kit");
  });

  it("TEST 3: A processing and B not processing stays 5/10 Kit", () => {
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("5/10 Kit");
  });

  it("TEST 4: both processing becomes 1 Kit", () => {
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");
  });

  it("TEST 5: a single processing 10-vial share is 1 Kit", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder()],
      [makeItem({ quantity: 10, line_total_usd: 60 })],
      [],
      selankKitContext({
        participants: [{ kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 10, order_id: "order-1" }],
      }),
    );
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");
  });

  it("TEST 6: two complete 10er kits are 2 Kits", () => {
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
    expect(buildProcessingOrderSummary(orders, items, [], context).groups[0]?.lines[0]?.quantityLabel).toBe("2 Kits");
  });

  it("TEST 6b: 5+5+5+5 of the same kit identity is 2 Kits", () => {
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("2 Kits");
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
    expect(summary.groups[0]?.lines.every((line) => line.quantityLabel === "5/10 Kit")).toBe(true);
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel)).not.toContain("1 Kit");
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("8 Kits");
    expect(summary.groups[0]?.lines[0]?.quantityLabel).not.toContain("Kit/s");
    expect(summary.groups[0]?.lines[0]?.quantityLabel).not.toContain("/");
  });

  it("TEST 9: PDF MENGE uses the same 1 Kit label as the web summary", () => {
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
    expect(summary.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");
    const bytes = buildProcessingOrderSummaryPdf(summary, "now");
    expect(pdfContainsAscii(bytes, "1 Kit")).toBe(true);
    expect(pdfContainsAscii(bytes, "5 Kits")).toBe(false);
    expect(pdfContainsAscii(bytes, "10 Kits")).toBe(false);
    expect(summary.personLines.map((line) => `${line.name}|${line.quantityLabel}`)).toEqual(["PepsiDry + Raff|1 Kit"]);
  });

  it("keeps 15 vials of size 10 as 1 Kit plus 5/10 Kit", () => {
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
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel).sort()).toEqual(["1 Kit", "5/10 Kit"]);
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
    expect(twenty.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");

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
    expect(thirty.groups[0]?.lines[0]?.quantityLabel).toBe("1 Kit");
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
      "SK10 1 Kit",
      "XA10 1 Kit",
    ]);
    expect(buildProcessingOrderSummary(orders, items, [], undefined).groups.length).toBeGreaterThan(0);
  });

  it("LIVE 2026-09-03: Selank+Semax 5/10+5/10 on the same kit_share_id become 1 Kit each; TE300 stays 5", () => {
    const order030 = makeOrder({
      id: "5539b116-bc33-4c63-9535-3a97cfe84dc4",
      order_number: "CW-2026-000030",
      user_id: "f6df0375-5d24-4ad4-b8b2-efcc6fd0b5f2",
      cart_id: "f8673972-9403-4701-be72-aa3850ba0870",
      telegram_username_snapshot: "PepQueen",
    });
    const order036 = makeOrder({
      id: "7b02ae6e-25b8-4f7f-999d-5557e0931445",
      order_number: "CW-2026-000036",
      user_id: "641e5d33-177a-4b7e-ac31-47e40ffb1cc7",
      cart_id: "a042b1df-cb53-4f02-9cdc-6461b91a2569",
      telegram_username_snapshot: "Penbuddy",
    });
    const order034 = makeOrder({
      id: "224ff4ce-38ae-41b8-8b0c-a68ba7cc5e07",
      order_number: "CW-2026-000034",
      user_id: "f0dc82df-7f75-4838-86c6-1e7161c7fa7b",
      cart_id: "6a2c7296-6ee2-4154-be76-0c840b7657b7",
      telegram_username_snapshot: "PepsiDry",
    });
    const selankId = "4c3de824-f70b-4cc4-8786-4293316d0fc1";
    const semaxId = "ffc0afc4-d984-41c0-96f4-b3c441e8ac2b";
    const te300Id = "a1ebe3d9-9c6e-4e1c-9146-0365f6ca2a61";
    const kitSelank = "42235edd-5dac-4468-a119-e7eae1dde2dd";
    const kitSemax = "d3f1c575-ca5d-406c-a169-5ba56dec75f8";
    const kitTe300Open = "13067fa5-dcad-4e71-9dbe-9c2c4b06355f";
    const liveQty = "5.000" as unknown as number;
    const items = [
      makeItem({
        id: "4f6d2b73-e99b-4ed5-afc0-f378ffcb04ce",
        order_id: order030.id,
        product_id: selankId,
        dosage_vial_snapshot: "10mg/vial x10vials",
        quantity: liveQty,
        line_total_usd: 30,
      }),
      makeItem({
        id: "38392aca-3602-42b7-814c-b33d17adb580",
        order_id: order030.id,
        product_id: semaxId,
        product_code_snapshot: "XA10",
        product_name_snapshot: "Semax",
        dosage_vial_snapshot: "10mg/vial x10vials",
        quantity: liveQty,
        line_total_usd: 27.5,
      }),
      makeItem({
        id: "6c8ed1ae-75a9-4f37-9031-96ff70c42a33",
        order_id: order036.id,
        product_id: selankId,
        dosage_vial_snapshot: "10mg/vial x10vials",
        quantity: liveQty,
        line_total_usd: 30,
      }),
      makeItem({
        id: "7bed61da-06b1-4538-b21c-a84ab4465e80",
        order_id: order036.id,
        product_id: semaxId,
        product_code_snapshot: "XA10",
        product_name_snapshot: "Semax",
        dosage_vial_snapshot: "10mg/vial x10vials",
        quantity: liveQty,
        line_total_usd: 27.5,
      }),
      makeItem({
        id: "0102ac31-af11-4a93-91aa-3aec783f7dab",
        order_id: order036.id,
        product_id: "7b2e5f53-1db2-4108-bf6c-237eb915396a",
        product_code_snapshot: "KP10",
        product_name_snapshot: "KPV",
        dosage_vial_snapshot: "10mg/vial x10vials",
        quantity: 1,
        line_total_usd: 55,
      }),
      makeItem({
        id: "4b072d35-cd14-4bb0-90ff-b66e2d4129d7",
        order_id: order036.id,
        product_id: "d0472ac8-e4b1-40ba-9454-3af2010b14df",
        product_code_snapshot: "2S10",
        product_name_snapshot: "SS-31",
        dosage_vial_snapshot: "10mg/vial x10vials",
        quantity: 1,
        line_total_usd: 80,
      }),
      makeItem({
        id: "5728873c-2049-4822-98df-e8779ee8950b",
        order_id: order036.id,
        product_id: "a1ec32d2-ac99-4f24-a298-0f6b3ad32d4c",
        product_code_snapshot: "NXA30",
        product_name_snapshot: "NA Semax amide",
        dosage_vial_snapshot: "30mg/vial x10vials",
        quantity: 1,
        line_total_usd: 135,
      }),
      makeOilItem({
        id: "98133866-e21c-4c11-ae0a-43bbc89f609b",
        order_id: order034.id,
        product_id: te300Id,
        dosage_vial_snapshot: "300mg",
        quantity: liveQty,
        line_total_usd: 85,
      }),
    ];
    const catalog = [
      { id: selankId, code: "SK10", name: "Selank", category: "PEPTIDES", dosage_vial: "10mg/vial x10vials" },
      { id: semaxId, code: "XA10", name: "Semax", category: "PEPTIDES", dosage_vial: "10mg/vial x10vials" },
      { id: te300Id, code: "TE300", name: "TEST ENANTHATE", category: "INJECTABLES-OILS", dosage_vial: "300mg" },
      { id: "7b2e5f53-1db2-4108-bf6c-237eb915396a", code: "KP10", name: "KPV", category: "PEPTIDES" },
      { id: "d0472ac8-e4b1-40ba-9454-3af2010b14df", code: "2S10", name: "SS-31", category: "PEPTIDES" },
      { id: "a1ec32d2-ac99-4f24-a298-0f6b3ad32d4c", code: "NXA30", name: "NA Semax amide", category: "PEPTIDES" },
    ];
    const context: KitShareOrderContext = {
      kits: [
        { id: kitSelank, product_id: selankId, kit_size_vials: 10 },
        { id: kitSemax, product_id: semaxId, kit_size_vials: 10 },
        { id: kitTe300Open, product_id: te300Id, kit_size_vials: 10 },
      ],
      participants: [
        { kit_share_id: kitSelank, user_id: order030.user_id as string, quantity: 5, order_id: order030.id },
        { kit_share_id: kitSelank, user_id: order036.user_id as string, quantity: 5, order_id: order036.id },
        { kit_share_id: kitSemax, user_id: order030.user_id as string, quantity: 5, order_id: order030.id },
        { kit_share_id: kitSemax, user_id: order036.user_id as string, quantity: 5, order_id: order036.id },
        { kit_share_id: kitTe300Open, user_id: order034.user_id as string, quantity: 1, order_id: null },
      ],
      cartLinks: [
        { cart_id: order030.cart_id as string, kit_share_id: kitSelank, product_id: selankId, quantity: 5 },
        { cart_id: order030.cart_id as string, kit_share_id: kitSemax, product_id: semaxId, quantity: 5 },
        { cart_id: order036.cart_id as string, kit_share_id: kitSelank, product_id: selankId, quantity: 5 },
        { cart_id: order036.cart_id as string, kit_share_id: kitSemax, product_id: semaxId, quantity: 5 },
      ],
    };

    const bothProcessing = buildProcessingOrderSummary([order030, order036, order034], items, catalog, context);
    const peptideLabels = bothProcessing.groups
      .find((group) => group.categoryId === "peptides")
      ?.lines.map((line) => `${line.code}|${line.quantityLabel}`)
      .sort();
    expect(peptideLabels).toEqual(["2S10|1 Kit", "KP10|1 Kit", "NXA30|1 Kit", "SK10|1 Kit", "XA10|1 Kit"]);
    expect(peptideLabels).not.toContain("SK10|5/10 Kit");
    expect(peptideLabels).not.toContain("XA10|5/10 Kit");
    expect(peptideLabels?.some((label) => label.includes("5 Kits"))).toBe(false);
    expect(bothProcessing.groups.find((group) => group.categoryId === "peptides")?.lines.find((line) => line.code === "SK10")).toMatchObject({
      name: "Selank",
      quantity: 1,
      quantityLabel: "1 Kit",
    });
    expect(bothProcessing.groups.find((group) => group.categoryId === "peptides")?.lines.find((line) => line.code === "XA10")).toMatchObject({
      name: "Semax",
      quantity: 1,
      quantityLabel: "1 Kit",
    });
    expect(bothProcessing.groups.find((group) => group.categoryId === "injectable-oils")?.lines[0]).toMatchObject({
      code: "TE300",
      quantityLabel: "5 Vials",
    });
    expect(
      bothProcessing.personLines
        .filter((line) => line.article === "Selank" || line.article === "Semax")
        .map((line) => `${line.name}|${line.quantityLabel}|${line.article}`)
        .sort(),
    ).toEqual([
      "Penbuddy + PepQueen|1 Kit|Selank",
      "Penbuddy + PepQueen|1 Kit|Semax",
    ]);
    const pdf = buildProcessingOrderSummaryPdf(bothProcessing, "now");
    expect(pdfContainsAscii(pdf, "1 Kit")).toBe(true);
    expect(pdfContainsAscii(pdf, "5 Kits")).toBe(false);
    expect(pdfContainsAscii(pdf, "5/10 Kit")).toBe(false);
    expect(pdfContainsAscii(pdf, "SK10")).toBe(true);
    expect(pdfContainsAscii(pdf, "XA10")).toBe(true);
    expect(pdfContainsAscii(pdf, "TE300")).toBe(true);
    expect(pdfContainsAscii(pdf, "Penbuddy")).toBe(true);
    expect(pdfContainsAscii(pdf, "PepQueen")).toBe(true);

    const only030 = buildProcessingOrderSummary(
      [order030, { ...order036, status: "pending" }, order034],
      items,
      catalog,
      context,
    );
    expect(
      only030.groups
        .find((group) => group.categoryId === "peptides")
        ?.lines.filter((line) => line.code === "SK10" || line.code === "XA10")
        .map((line) => line.quantityLabel),
    ).toEqual(["5/10 Kit", "5/10 Kit"]);
    expect(
      only030.personLines
        .filter((line) => line.article === "Selank" || line.article === "Semax")
        .map((line) => `${line.name}|${line.quantityLabel}|${line.article}`)
        .sort(),
    ).toEqual(["PepQueen|5/10 Kit|Selank", "PepQueen|5/10 Kit|Semax"]);

    const selankPanel = buildSharedKitsForOrder(order036.id, items.filter((item) => item.order_id === order036.id), [order030, order036], context);
    expect(selankPanel.map((view) => `${view.productCode}|${view.progressLabel}|${view.complete}`).sort()).toEqual([
      "SK10|10/10 bestellt|true",
      "XA10|10/10 bestellt|true",
    ]);
    expect(selankPanel[0]?.participants.map((p) => p.telegramLabel).sort()).toEqual(["Penbuddy", "PepQueen"]);
  });

  it("still shows 1 Kit when both processing lines share a kit_share_id but one participant row is missing", () => {
    const order030 = makeOrder({
      id: "5539b116-bc33-4c63-9535-3a97cfe84dc4",
      order_number: "CW-2026-000030",
      user_id: "f6df0375-5d24-4ad4-b8b2-efcc6fd0b5f2",
      cart_id: "f8673972-9403-4701-be72-aa3850ba0870",
      telegram_username_snapshot: "PepQueen",
    });
    const order036 = makeOrder({
      id: "7b02ae6e-25b8-4f7f-999d-5557e0931445",
      order_number: "CW-2026-000036",
      user_id: "641e5d33-177a-4b7e-ac31-47e40ffb1cc7",
      cart_id: "a042b1df-cb53-4f02-9cdc-6461b91a2569",
      telegram_username_snapshot: "Penbuddy",
    });
    const selankId = "4c3de824-f70b-4cc4-8786-4293316d0fc1";
    const kitSelank = "42235edd-5dac-4468-a119-e7eae1dde2dd";
    const items = [
      makeItem({
        id: "4f6d2b73-e99b-4ed5-afc0-f378ffcb04ce",
        order_id: order030.id,
        product_id: selankId,
        quantity: "5.000" as unknown as number,
        line_total_usd: 30,
      }),
      makeItem({
        id: "6c8ed1ae-75a9-4f37-9031-96ff70c42a33",
        order_id: order036.id,
        product_id: selankId,
        quantity: "5.000" as unknown as number,
        line_total_usd: 30,
      }),
    ];
    const context: KitShareOrderContext = {
      kits: [{ id: kitSelank, product_id: selankId, kit_size_vials: 10 }],
      participants: [
        { kit_share_id: kitSelank, user_id: order030.user_id as string, quantity: 5, order_id: order030.id },
      ],
      cartLinks: [
        { cart_id: order030.cart_id as string, kit_share_id: kitSelank, product_id: selankId, quantity: 5 },
        { cart_id: order036.cart_id as string, kit_share_id: kitSelank, product_id: selankId, quantity: 5 },
      ],
    };
    const summary = buildProcessingOrderSummary([order030, order036], items, [], context);
    expect(summary.groups[0]?.lines.map((line) => `${line.code}|${line.quantityLabel}`)).toEqual(["SK10|1 Kit"]);
    expect(summary.groups[0]?.lines.map((line) => line.quantityLabel)).not.toContain("5/10 Kit");
    expect(
      summary.personLines.map((line) => `${line.name}|${line.quantityLabel}|${line.article}`).sort(),
    ).toEqual(["Penbuddy + PepQueen|1 Kit|Selank"]);
    expect(pdfContainsAscii(buildProcessingOrderSummaryPdf(summary, "now"), "1 Kit")).toBe(true);
    expect(pdfContainsAscii(buildProcessingOrderSummaryPdf(summary, "now"), "5/10 Kit")).toBe(false);
  });

  it("TEST oil: an open same-product kit membership does not turn TEST ENANTHATE 5 into a kit", () => {
    const order = makeOrder({ id: "order-34", user_id: "user-oil" });
    const context: KitShareOrderContext = {
      kits: [{ id: "kit-te300-open", product_id: "prod-te300", kit_size_vials: 10 }],
      participants: [{ kit_share_id: "kit-te300-open", user_id: "user-oil", quantity: 1, order_id: null }],
    };
    const summary = buildProcessingOrderSummary([order], [makeOilItem({ order_id: "order-34" })], oilCatalog, context);
    const oilLine = summary.groups.find((group) => group.categoryId === "injectable-oils")?.lines[0];
    expect(oilLine).toMatchObject({ code: "TE300", name: "TEST ENANTHATE", quantity: 5, quantityLabel: "5 Vials" });
    expect(oilLine?.quantityLabel).not.toContain("Kit");
    expect(oilLine?.quantityLabel).not.toContain("/");
    expect(summary.personLines[0]?.quantityLabel).toBe("5 Vials");
  });

  it("TEST 1-3: peptide and injectable oil quantities use category units", () => {
    const peptide = buildProcessingOrderSummary(
      [makeOrder()],
      [makeItem({ quantity: 5, line_total_usd: 50 })],
    );
    expect(peptide.groups[0]?.lines[0]?.quantityLabel).toBe("5 Kits");

    const oilFive = buildProcessingOrderSummary(
      [makeOrder()],
      [makeOilItem({ quantity: 5 })],
      oilCatalog,
    );
    expect(oilFive.groups.find((group) => group.categoryId === "injectable-oils")?.lines[0]?.quantityLabel).toBe("5 Vials");

    const oilTen = buildProcessingOrderSummary(
      [makeOrder()],
      [makeOilItem({ id: "oil-10", quantity: 10, line_total_usd: 170 })],
      oilCatalog,
    );
    expect(oilTen.groups.find((group) => group.categoryId === "injectable-oils")?.lines[0]?.quantityLabel).toBe("10 Vials");
  });

  it("TEST 11: two different injectable oils aggregate as themselves", () => {
    const orders = [makeOrder({ id: "a" }), makeOrder({ id: "b", order_number: "CN-2026-000033" })];
    const items = [
      makeOilItem({ id: "te", order_id: "a", quantity: 5, line_total_usd: 85 }),
      makeOilItem({
        id: "tren",
        order_id: "b",
        product_id: "prod-tren",
        product_code_snapshot: "R200",
        product_name_snapshot: "Tren E",
        quantity: 3,
        line_total_usd: 90,
      }),
    ];
    const summary = buildProcessingOrderSummary(orders, items, [
      ...oilCatalog,
      { id: "prod-tren", code: "R200", name: "Tren E", category: "INJECTABLES-OILS" },
    ]);
    const oils = summary.groups.find((group) => group.categoryId === "injectable-oils")?.lines ?? [];
    expect(oils.map((line) => `${line.code} ${line.quantityLabel}`).sort()).toEqual(["R200 3 Vials", "TE300 5 Vials"]);
  });

  it("TEST 12-14: PDF uses the same labels for a complete kit and a normal oil", () => {
    const orders = [
      makeOrder({ telegram_username_snapshot: "PepsiDry" }),
      makeOrder({ id: "order-2", user_id: "user-raff", telegram_username_snapshot: "PepQueen" }),
      makeOrder({ id: "order-oil", user_id: "user-oil", telegram_username_snapshot: "OilUser", order_number: "CN-2026-000099" }),
    ];
    const items = [
      makeItem(),
      makeItem({ id: "item-2", order_id: "order-2" }),
      makeOilItem({ order_id: "order-oil" }),
    ];
    const summary = buildProcessingOrderSummary(orders, items, oilCatalog, selankKitContext());
    expect(summary.groups.find((group) => group.categoryId === "peptides")?.lines[0]?.quantityLabel).toBe("1 Kit");
    expect(summary.groups.find((group) => group.categoryId === "injectable-oils")?.lines[0]?.quantityLabel).toBe("5 Vials");
    const bytes = buildProcessingOrderSummaryPdf(summary, "now");
    expect(pdfContainsAscii(bytes, "1 Kit")).toBe(true);
    expect(pdfContainsAscii(bytes, "5 Kits")).toBe(false);
    expect(pdfContainsAscii(bytes, "TE300")).toBe(true);
    expect(summary.personLines.filter((line) => line.article === "Selank").map((line) => `${line.name}|${line.quantityLabel}|${line.article}`).sort()).toEqual([
      "PepQueen + PepsiDry|1 Kit|Selank",
    ]);
    expect(summary.personLines.find((line) => line.article === "TEST ENANTHATE")).toMatchObject({
      name: "OilUser",
      quantityLabel: "5 Vials",
      article: "TEST ENANTHATE",
    });
  });

  it("does not attach a regular cart line to a kit share of a different product", () => {
    const order = makeOrder({ cart_id: "cart-mix" });
    const summary = buildProcessingOrderSummary(
      [order],
      [makeOilItem(), makeItem()],
      oilCatalog,
      selankKitContext({
        participants: [{ kit_share_id: "kit-10", user_id: "user-pepsi", quantity: 5, order_id: "order-1" }],
        cartLinks: [
          { cart_id: "cart-mix", kit_share_id: "kit-10", product_id: "prod-te300", quantity: 5 },
        ],
      }),
    );
    expect(summary.groups.find((group) => group.categoryId === "injectable-oils")?.lines[0]?.quantityLabel).toBe("5 Vials");
    expect(summary.groups.find((group) => group.categoryId === "peptides")?.lines[0]?.quantityLabel).toBe("5/10 Kit");
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
      "PepsiDry|5/10 Kit|In Bearbeitung|true",
      "Raff|5/10 Kit|Eingegangen|false",
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
    expect(hooks).toContain("QUERY_KEYS.adminOrderSummary");
    expect(read("src/lib/constants.ts")).toContain('adminOrderSummary: ["admin-order-summary"]');
    expect(read("src/lib/kitOrderSummary.ts")).not.toContain("const forUser = participants.filter");
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

  it("BESTELLUNGEN and PDF reuse personLines.quantityLabel and never reformat customers or order items", () => {
    const page = read("src/pages/admin/AdminOrderSummary.tsx");
    expect(page).toContain("summary.personLines.map");
    expect(page).toContain("{line.quantityLabel}");
    expect(page).not.toContain("summary.customers");
    expect(page).not.toContain("formatSharedKitShareLabel");
    expect(page).not.toContain("formatOrderItemQuantity");
    expect(page).not.toContain("formatCatalogQuantity");
    const pdf = read("src/lib/pdf/peptixOrderSummaryPdf.ts");
    expect(pdf).toContain("summary.personLines");
    expect(pdf).toContain("line.quantityLabel");
    expect(pdf).not.toContain("summary.customers");
    expect(pdf).not.toContain("formatSharedKitShareLabel");
    expect(pdf).not.toContain("formatOrderItemQuantity");
    const html = read("src/lib/orderSummaryExport.ts");
    expect(html).toContain("summary.personLines");
    expect(html).toContain("line.quantityLabel");
    expect(html).not.toContain("summary.customers");
  });
});

describe("live Penbuddy/PepQueen kit replay (production identities, status overridden in test only)", () => {
  it("5 + 5 vials of kit_size_vials 10 is exactly 1 complete kit", () => {
    const vials = asQuantity(LIVE_QTY) + asQuantity(LIVE_QTY);
    expect(vials).toBe(10);
    expect(splitKitProgress(vials, 10)).toEqual({ completeKits: 1, remainderVials: 0 });
    expect(formatCompleteKitQuantityLabel(1, "peptides", 10)).toBe("1 Kit");
  });

  it("same kit_share_id, both processing: merchant groups and BESTELLUNGEN are 1 Kit, participants stay 5/10 Kit", () => {
    const { pepQueen, penbuddy, pepsi, items, catalog, context } = livePenbuddyPepQueenReplay();
    const summary = buildProcessingOrderSummary([pepQueen, penbuddy, pepsi], items, catalog, context);
    const peptides = summary.groups.find((group) => group.categoryId === "peptides")?.lines ?? [];
    expect(peptides.map((line) => `${line.code}|${line.quantityLabel}`).sort()).toEqual(["SK10|1 Kit", "XA10|1 Kit"]);
    expect(peptides.map((line) => line.quantityLabel)).not.toContain("5/10 Kit");
    expect(peptides.map((line) => line.quantityLabel)).not.toContain("5 Kits");
    expect(peptides.map((line) => line.quantityLabel)).not.toContain("10 Stück");
    expect(peptides.find((line) => line.code === "SK10")).toMatchObject({ quantity: 1, quantityLabel: "1 Kit" });
    expect(peptides.find((line) => line.code === "XA10")).toMatchObject({ quantity: 1, quantityLabel: "1 Kit" });
    expect(
      summary.personLines
        .filter((line) => line.article === "Selank" || line.article === "Semax")
        .map((line) => `${line.name}|${line.quantityLabel}|${line.article}`)
        .sort(),
    ).toEqual(["Penbuddy + PepQueen|1 Kit|Selank", "Penbuddy + PepQueen|1 Kit|Semax"]);
    expect(summary.personLines.filter((line) => line.article === "Selank")).toHaveLength(1);
    expect(summary.personLines.filter((line) => line.article === "Semax")).toHaveLength(1);
    const pepQueenShares = summary.customers
      .find((customer) => customer.orderNumber === "CW-2026-000030")
      ?.lines.map((line) => `${line.code}|${line.quantityLabel}`)
      .sort();
    const penbuddyShares = summary.customers
      .find((customer) => customer.orderNumber === "CW-2026-000036")
      ?.lines.map((line) => `${line.code}|${line.quantityLabel}`)
      .sort();
    expect(pepQueenShares).toEqual(["SK10|5/10 Kit", "XA10|5/10 Kit"]);
    expect(penbuddyShares).toEqual(["SK10|5/10 Kit", "XA10|5/10 Kit"]);
    const kitPanel = buildSharedKitsForOrder(
      penbuddy.id,
      items.filter((item) => item.order_id === penbuddy.id),
      [pepQueen, penbuddy],
      context,
    );
    expect(
      kitPanel.flatMap((kit) => kit.participants.map((row) => `${kit.productCode}|${row.telegramLabel}|${row.shareLabel}`)).sort(),
    ).toEqual([
      "SK10|Penbuddy|5/10 Kit",
      "SK10|PepQueen|5/10 Kit",
      "XA10|Penbuddy|5/10 Kit",
      "XA10|PepQueen|5/10 Kit",
    ]);
  });

  it("cancelled kit participant does not complete merchant aggregation; remaining share stays 5/10 Kit", () => {
    const { pepQueen, penbuddy, pepsi, items, catalog, context } = livePenbuddyPepQueenReplay("cancelled", "processing");
    const summary = buildProcessingOrderSummary([pepQueen, penbuddy, pepsi], items, catalog, context);
    const peptides = summary.groups.find((group) => group.categoryId === "peptides")?.lines ?? [];
    expect(peptides.map((line) => `${line.code}|${line.quantityLabel}`).sort()).toEqual(["SK10|5/10 Kit", "XA10|5/10 Kit"]);
    expect(peptides.map((line) => line.quantityLabel)).not.toContain("1 Kit");
    expect(summary.customers.find((customer) => customer.orderNumber === "CW-2026-000030")).toBeUndefined();
    expect(
      summary.personLines
        .filter((line) => line.article === "Selank" || line.article === "Semax")
        .map((line) => `${line.name}|${line.quantityLabel}|${line.article}`)
        .sort(),
    ).toEqual(["Penbuddy|5/10 Kit|Selank", "Penbuddy|5/10 Kit|Semax"]);
    const kitPanel = buildSharedKitsForOrder(
      penbuddy.id,
      items.filter((item) => item.order_id === penbuddy.id),
      [pepQueen, penbuddy],
      context,
    );
    expect(
      kitPanel.flatMap((kit) => kit.participants.map((row) => `${kit.productCode}|${row.telegramLabel}|${row.shareLabel}`)).sort(),
    ).toEqual([
      "SK10|Penbuddy|5/10 Kit",
      "SK10|PepQueen|5/10 Kit",
      "XA10|Penbuddy|5/10 Kit",
      "XA10|PepQueen|5/10 Kit",
    ]);
  });

  it("PDF BESTELLUNGEN uses the same 1 Kit merchant aggregation, not participant 5/10 Kit rows", () => {
    const { pepQueen, penbuddy, pepsi, items, catalog, context } = livePenbuddyPepQueenReplay();
    const summary = buildProcessingOrderSummary([pepQueen, penbuddy, pepsi], items, catalog, context);
    const bytes = buildProcessingOrderSummaryPdf(summary, "now");
    expect(pdfContainsAscii(bytes, "1 Kit")).toBe(true);
    expect(pdfContainsAscii(bytes, "5/10 Kit")).toBe(false);
    expect(pdfContainsAscii(bytes, "5 Kits")).toBe(false);
    expect(pdfContainsAscii(bytes, "10 St")).toBe(false);
    expect(pdfContainsAscii(bytes, "SK10")).toBe(true);
    expect(pdfContainsAscii(bytes, "XA10")).toBe(true);
    expect(pdfContainsAscii(bytes, "Penbuddy")).toBe(true);
    expect(pdfContainsAscii(bytes, "PepQueen")).toBe(true);
    expect(summary.personLines.find((line) => line.article === "Selank")?.quantityLabel).toBe(
      summary.groups.find((group) => group.categoryId === "peptides")?.lines.find((line) => line.code === "SK10")
        ?.quantityLabel,
    );
  });

  it("two different kit_share_id with 5/10 each stay two 5/10 Kit lines", () => {
    const { pepQueen, penbuddy, items, catalog, context } = livePenbuddyPepQueenReplay();
    const otherSelank = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const otherSemax = "ffffffff-0000-1111-2222-333333333333";
    const splitContext: KitShareOrderContext = {
      ...context,
      kits: [
        { id: LIVE_KIT_SELANK, product_id: LIVE_SELANK_ID, kit_size_vials: 10 },
        { id: otherSelank, product_id: LIVE_SELANK_ID, kit_size_vials: 10 },
        { id: LIVE_KIT_SEMAX, product_id: LIVE_SEMAX_ID, kit_size_vials: 10 },
        { id: otherSemax, product_id: LIVE_SEMAX_ID, kit_size_vials: 10 },
      ],
      participants: [
        { kit_share_id: LIVE_KIT_SELANK, user_id: pepQueen.user_id as string, quantity: 5, order_id: pepQueen.id },
        { kit_share_id: otherSelank, user_id: penbuddy.user_id as string, quantity: 5, order_id: penbuddy.id },
        { kit_share_id: LIVE_KIT_SEMAX, user_id: pepQueen.user_id as string, quantity: 5, order_id: pepQueen.id },
        { kit_share_id: otherSemax, user_id: penbuddy.user_id as string, quantity: 5, order_id: penbuddy.id },
      ],
      cartLinks: [
        { cart_id: pepQueen.cart_id as string, kit_share_id: LIVE_KIT_SELANK, product_id: LIVE_SELANK_ID, quantity: 5 },
        { cart_id: pepQueen.cart_id as string, kit_share_id: LIVE_KIT_SEMAX, product_id: LIVE_SEMAX_ID, quantity: 5 },
        { cart_id: penbuddy.cart_id as string, kit_share_id: otherSelank, product_id: LIVE_SELANK_ID, quantity: 5 },
        { cart_id: penbuddy.cart_id as string, kit_share_id: otherSemax, product_id: LIVE_SEMAX_ID, quantity: 5 },
      ],
    };
    const kitItems = items.filter((item) => item.product_id === LIVE_SELANK_ID || item.product_id === LIVE_SEMAX_ID);
    const summary = buildProcessingOrderSummary([pepQueen, penbuddy], kitItems, catalog, splitContext);
    const peptides = summary.groups.find((group) => group.categoryId === "peptides")?.lines ?? [];
    expect(peptides.map((line) => `${line.code}|${line.quantityLabel}`).sort()).toEqual([
      "SK10|5/10 Kit",
      "SK10|5/10 Kit",
      "XA10|5/10 Kit",
      "XA10|5/10 Kit",
    ]);
    expect(peptides.map((line) => line.quantityLabel)).not.toContain("1 Kit");
    expect(
      summary.personLines
        .filter((line) => line.article === "Selank" || line.article === "Semax")
        .map((line) => `${line.name}|${line.quantityLabel}|${line.article}`)
        .sort(),
    ).toEqual([
      "Penbuddy|5/10 Kit|Selank",
      "Penbuddy|5/10 Kit|Semax",
      "PepQueen|5/10 Kit|Selank",
      "PepQueen|5/10 Kit|Semax",
    ]);
  });

  it("normal injectable oil qty 5 without kit link stays 5 Vials", () => {
    const { pepQueen, penbuddy, pepsi, items, catalog, context } = livePenbuddyPepQueenReplay();
    const summary = buildProcessingOrderSummary([pepQueen, penbuddy, pepsi], items, catalog, context);
    const oil = summary.groups.find((group) => group.categoryId === "injectable-oils")?.lines[0];
    expect(oil).toMatchObject({ code: "TE300", quantity: 5, quantityLabel: "5 Vials" });
    expect(oil?.quantityLabel).not.toContain("Kit");
    expect(summary.personLines.find((line) => line.article === "TEST ENANTHATE")?.quantityLabel).toBe("5 Vials");
  });

  it("only one of the two orders processing stays 5/10 Kit", () => {
    const { pepQueen, penbuddy, items, catalog, context } = livePenbuddyPepQueenReplay("processing", "dispatched");
    const kitItems = items.filter((item) => item.product_id === LIVE_SELANK_ID || item.product_id === LIVE_SEMAX_ID);
    const summary = buildProcessingOrderSummary([pepQueen, penbuddy], kitItems, catalog, context);
    const peptides = summary.groups.find((group) => group.categoryId === "peptides")?.lines ?? [];
    expect(peptides.map((line) => `${line.code}|${line.quantityLabel}`).sort()).toEqual(["SK10|5/10 Kit", "XA10|5/10 Kit"]);
    expect(
      summary.personLines.map((line) => `${line.name}|${line.quantityLabel}|${line.article}`).sort(),
    ).toEqual(["PepQueen|5/10 Kit|Selank", "PepQueen|5/10 Kit|Semax"]);
    expect(summary.customers[0]?.lines.map((line) => line.quantityLabel).sort()).toEqual(["5/10 Kit", "5/10 Kit"]);
  });

  it("both processing after a dispatched live snapshot is overridden only in the test: 1 Kit", () => {
    const { pepQueen, penbuddy, items, catalog, context } = livePenbuddyPepQueenReplay("processing", "processing");
    const kitItems = items.filter((item) => item.product_id === LIVE_SELANK_ID || item.product_id === LIVE_SEMAX_ID);
    const summary = buildProcessingOrderSummary([pepQueen, penbuddy], kitItems, catalog, context);
    expect(summary.groups.find((group) => group.categoryId === "peptides")?.lines.map((line) => line.quantityLabel)).toEqual([
      "1 Kit",
      "1 Kit",
    ]);
    expect(summary.personLines.map((line) => line.quantityLabel).sort()).toEqual(["1 Kit", "1 Kit"]);
  });
});

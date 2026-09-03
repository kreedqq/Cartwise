import { describe, expect, it, vi } from "vitest";

import { buildProcessingOrderSummaryPrintHtml, printProcessingOrderSummary } from "@/lib/orderExport";
import { buildProcessingOrderSummary, ORDER_SUMMARY_CATEGORY_LABELS } from "@/lib/orderSummary";
import type { Tables } from "@/types/database";

function makeOrder(overrides: Partial<Tables<"orders">> = {}): Tables<"orders"> {
  const now = new Date().toISOString();
  return {
    id: "order-1",
    order_number: "CN-2026-000034",
    user_id: "user-1",
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
    product_id: "prod-10",
    product_code_snapshot: "RETA10",
    product_name_snapshot: "Retatrutide 10 mg",
    dosage_vial_snapshot: "10mg",
    description_snapshot: null,
    normal_price_usd_snapshot: 50,
    bulk_price_usd_snapshot: null,
    bulk_price_min_quantity_snapshot: null,
    applied_price_tier: "normal",
    unit_price_usd_snapshot: 50,
    quantity: 3,
    line_total_usd: 150,
    exchange_rate_snapshot: null,
    eur_value_snapshot: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildProcessingOrderSummary", () => {
  it("merges identical SKUs from processing orders and keeps strengths separate", () => {
    const orders = [
      makeOrder({ id: "a", order_number: "CN-2026-000034", status: "processing", telegram_username_snapshot: "PepsiDry" }),
      makeOrder({ id: "b", order_number: "CN-2026-000033", status: "processing", telegram_username_snapshot: "Raff" }),
      makeOrder({ id: "c", order_number: "CN-2026-000032", status: "processing", telegram_username_snapshot: "Wauzzz_20V" }),
      makeOrder({ id: "d", order_number: "CN-2026-000031", status: "pending", telegram_username_snapshot: "Skip" }),
    ];
    const items = [
      makeItem({ id: "i1", order_id: "a", product_code_snapshot: "RETA10", product_name_snapshot: "Retatrutide 10 mg", quantity: 3, line_total_usd: 150 }),
      makeItem({ id: "i2", order_id: "b", product_code_snapshot: "RETA10", product_name_snapshot: "Retatrutide 10 mg", quantity: 5, line_total_usd: 250 }),
      makeItem({ id: "i3", order_id: "c", product_code_snapshot: "RETA10", product_name_snapshot: "Retatrutide 10 mg", quantity: 2, line_total_usd: 100 }),
      makeItem({ id: "i4", order_id: "a", product_id: "prod-20", product_code_snapshot: "RETA20", product_name_snapshot: "Retatrutide 20 mg", quantity: 1, line_total_usd: 80 }),
      makeItem({ id: "i5", order_id: "d", product_code_snapshot: "RETA10", product_name_snapshot: "Retatrutide 10 mg", quantity: 99, line_total_usd: 4950 }),
    ];
    const summary = buildProcessingOrderSummary(orders, items, [
      { id: "prod-10", code: "RETA10", name: "Retatrutide 10 mg", category: "PEPTIDES" },
      { id: "prod-20", code: "RETA20", name: "Retatrutide 20 mg", category: "PEPTIDES" },
    ]);

    expect(summary.orderCount).toBe(3);
    const reta10 = summary.groups[0]?.lines.find((line) => line.code === "RETA10");
    const reta20 = summary.groups[0]?.lines.find((line) => line.code === "RETA20");
    expect(reta10?.quantity).toBe(10);
    expect(reta10?.totalUsd).toBe(500);
    expect(reta20?.quantity).toBe(1);
    expect(reta20?.totalUsd).toBe(80);
    expect(summary.productCount).toBe(2);
    expect(summary.totalQuantity).toBe(11);
    expect(summary.totalUsd).toBe(580);
  });

  it("ignores every status other than In Bearbeitung", () => {
    const orders = [
      makeOrder({ id: "pending", status: "pending" }),
      makeOrder({ id: "sent", status: "dispatched" }),
      makeOrder({ id: "done", status: "completed" }),
    ];
    const items = [
      makeItem({ order_id: "pending", quantity: 1, line_total_usd: 50 }),
      makeItem({ id: "i2", order_id: "sent", quantity: 1, line_total_usd: 50 }),
      makeItem({ id: "i3", order_id: "done", quantity: 1, line_total_usd: 50 }),
    ];
    const summary = buildProcessingOrderSummary(orders, items);
    expect(summary.orderCount).toBe(0);
    expect(summary.groups).toEqual([]);
    expect(summary.customers).toEqual([]);
  });

  it("groups by existing shop categories and uses snapshot names, not live profile names", () => {
    const orders = [makeOrder({ telegram_username_snapshot: "PepsiDry" })];
    const items = [
      makeItem({ product_code_snapshot: "RETA10", product_name_snapshot: "Retatrutide 10 mg" }),
      makeItem({
        id: "oil-1",
        product_id: "oil",
        product_code_snapshot: "OIL1",
        product_name_snapshot: "Testosterone 250",
        quantity: 2,
        line_total_usd: 40,
      }),
    ];
    const summary = buildProcessingOrderSummary(orders, items, [
      { id: "prod-10", code: "RETA10", name: "Live renamed peptide", category: "PEPTIDES" },
      { id: "oil", code: "OIL1", name: "Live renamed oil", category: "INJECTABLE OILS" },
    ]);
    expect(summary.groups.map((group) => group.label)).toEqual(["Peptide", "Injectable Oils"]);
    expect(summary.groups[0]?.lines[0]?.name).toBe("Retatrutide 10 mg");
    expect(summary.groups[1]?.lines[0]?.name).toBe("Testosterone 250");
    expect(summary.customers[0]?.heading).toBe("CN-2026-000034 | PepsiDry");
    expect(summary.customers[0]?.orderNumber).toBe("CN-2026-000034");
    expect(summary.customers[0]?.telegramLabel).toBe("PepsiDry");
  });

  it("does not merge missing Telegram snapshots into one customer", () => {
    const orders = [
      makeOrder({ id: "a", order_number: "CN-2026-000001", telegram_username_snapshot: null }),
      makeOrder({ id: "b", order_number: "CN-2026-000002", telegram_username_snapshot: "   " }),
    ];
    const items = [
      makeItem({ order_id: "a", quantity: 1, line_total_usd: 10 }),
      makeItem({ id: "i2", order_id: "b", quantity: 2, line_total_usd: 20 }),
    ];
    const summary = buildProcessingOrderSummary(orders, items);
    expect(summary.customers).toHaveLength(2);
    expect(summary.customers.map((customer) => customer.heading)).toEqual([
      "CN-2026-000001 | Nicht verfügbar",
      "CN-2026-000002 | Nicht verfügbar",
    ]);
    expect(summary.customers.every((customer) => customer.telegramLabel === "Nicht verfügbar")).toBe(true);
  });

  it("does not crash when product data is missing", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder()],
      [makeItem({ product_id: null, product_code_snapshot: "", product_name_snapshot: "", quantity: 1, line_total_usd: 1 })],
    );
    expect(summary.orderCount).toBe(1);
    expect(summary.groups[0]?.lines[0]?.code).toBe("—");
    expect(summary.groups[0]?.lines[0]?.name).toBe("Nicht verfügbar");
  });

  it("keeps Peptide, Injectable Oils, Orals, Reconstitution Water in that order", () => {
    expect(Object.values(ORDER_SUMMARY_CATEGORY_LABELS)).toEqual([
      "Peptide",
      "Injectable Oils",
      "Orals",
      "Reconstitution Water",
    ]);
    const summary = buildProcessingOrderSummary(
      [makeOrder()],
      [
        makeItem({ product_code_snapshot: "RETA10", product_name_snapshot: "Retatrutide 10 mg" }),
        makeItem({
          id: "oil",
          product_id: "oil",
          product_code_snapshot: "OIL1",
          product_name_snapshot: "Testosterone 250",
          quantity: 1,
          line_total_usd: 10,
        }),
        makeItem({
          id: "oral",
          product_id: "oral",
          product_code_snapshot: "ORAL1",
          product_name_snapshot: "Anavar 10",
          quantity: 1,
          line_total_usd: 10,
        }),
        makeItem({
          id: "water",
          product_id: "water",
          product_code_snapshot: "BA10",
          product_name_snapshot: "BAC Water",
          quantity: 1,
          line_total_usd: 10,
        }),
      ],
      [
        { id: "prod-10", code: "RETA10", category: "PEPTIDES" },
        { id: "oil", code: "OIL1", category: "INJECTABLE OILS" },
        { id: "oral", code: "ORAL1", category: "ORALS" },
        { id: "water", code: "BA10", category: "RECONSTITUTION WATER" },
      ],
    );
    expect(summary.groups.map((group) => group.label)).toEqual([
      "Peptide",
      "Injectable Oils",
      "Orals",
      "Reconstitution Water",
    ]);
  });

  it("lists each order separately with order number as the primary customer heading", () => {
    const summary = buildProcessingOrderSummary(
      [
        makeOrder({ id: "a", order_number: "CN-2026-000034", telegram_username_snapshot: "PepsiDry" }),
        makeOrder({ id: "b", order_number: "CN-2026-000033", telegram_username_snapshot: "PepsiDry" }),
      ],
      [
        makeItem({ order_id: "a", quantity: 1, line_total_usd: 10 }),
        makeItem({ id: "i2", order_id: "b", quantity: 2, line_total_usd: 20 }),
      ],
    );
    expect(summary.customers.map((customer) => customer.heading)).toEqual([
      "CN-2026-000033 | PepsiDry",
      "CN-2026-000034 | PepsiDry",
    ]);
  });
});

describe("processing order summary PDF", () => {
  it("prints merchant totals plus a customer overview from snapshots", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder({ telegram_username_snapshot: "PepsiDry" })],
      [makeItem({ quantity: 3, line_total_usd: 150 })],
      [{ id: "prod-10", code: "RETA10", name: "Retatrutide 10 mg", category: "PEPTIDES" }],
    );
    const html = buildProcessingOrderSummaryPrintHtml(summary, "03.09.2026, 10:00");
    expect(html).toContain("BESTELL ZUSAMMENFASSUNG");
    expect(html).toContain("In Bearbeitung");
    expect(html).toContain("Peptide");
    expect(html).not.toContain(">Peptides<");
    expect(html).toContain("RETA10");
    expect(html).toContain("Retatrutide 10 mg");
    expect(html).toContain("Kundenübersicht");
    expect(html).toContain("CN-2026-000034 | PepsiDry");
    expect(html).toContain("3 × Retatrutide 10 mg");
    expect(html).not.toContain("CurrentProfile");
    expect(html).not.toContain("display_name");
    expect(html).not.toContain("1,25");
    expect(html).not.toContain("25 %");
  });

  it("does not print an empty merchant PDF", () => {
    const open = vi.fn();
    const original = window.open;
    window.open = open as typeof window.open;
    try {
      printProcessingOrderSummary(buildProcessingOrderSummary([], []), "now");
      expect(open).not.toHaveBeenCalled();
    } finally {
      window.open = original;
    }
  });
});

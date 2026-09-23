import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  buildProcessingOrderSummaryPdf,
  buildProcessingOrderSummaryPrintHtml,
  printProcessingOrderSummary,
} from "@/lib/orderSummaryExport";
import {
  aggregateMerchantQuantitiesByCode,
  buildChinaPurchaseSummary,
  buildProcessingOrderSummary,
  formatChinaPurchasePriceCells,
  ORDER_SUMMARY_CATEGORY_LABELS,
} from "@/lib/orderSummary";
import { planPeptixOrderSummaryPages } from "@/lib/pdf/peptixOrderSummaryPdf";
import { EMPTY_ORDER_TRACKING } from "@/lib/tracking";
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
    revision_number: 0,
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
    product_id: "prod-10",
    kit_share_id_snapshot: null,
    kit_size_vials_snapshot: null,
    kit_participant_quantity_snapshot: null,
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

  it("merges page-4 lines by telegram snapshot and keeps different doses separate", () => {
    const summary = buildProcessingOrderSummary(
      [
        makeOrder({ id: "a", order_number: "CN-2026-000034", telegram_username_snapshot: "Pasi" }),
        makeOrder({ id: "b", order_number: "CN-2026-000033", telegram_username_snapshot: "Pasi" }),
      ],
      [
        makeItem({
          order_id: "a",
          product_code_snapshot: "RETA5",
          product_name_snapshot: "Retatrutid",
          dosage_vial_snapshot: "5mg",
          quantity: 4,
          line_total_usd: 40,
        }),
        makeItem({
          id: "i2",
          order_id: "b",
          product_id: "prod-10",
          product_code_snapshot: "RETA5",
          product_name_snapshot: "Retatrutid",
          dosage_vial_snapshot: "5mg",
          quantity: 6,
          line_total_usd: 60,
        }),
        makeItem({
          id: "i3",
          order_id: "b",
          product_id: "prod-20",
          product_code_snapshot: "RETA10",
          product_name_snapshot: "Retatrutid",
          dosage_vial_snapshot: "10mg",
          quantity: 5,
          line_total_usd: 80,
        }),
      ],
    );
    expect(summary.personCount).toBe(1);
    expect(
      summary.personLines.map((line) => `${line.name}|${line.quantityLabel}|${line.dose}|${line.article}`),
    ).toEqual([
      "Pasi|5 Kits|10 mg|Retatrutid",
      "Pasi|10 Kits|5 mg|Retatrutid",
    ]);
    expect(summary.customers.map((customer) => customer.orderNumber)).toEqual(["CN-2026-000033", "CN-2026-000034"]);
  });

  it("uses Nicht verfügbar for a missing snapshot and dose and never live profile names", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder({ telegram_username_snapshot: null })],
      [makeItem({ dosage_vial_snapshot: null, product_name_snapshot: "Selank" })],
    );
    expect(summary.personLines[0]?.name).toBe("Nicht verfügbar");
    expect(summary.personLines[0]?.dose).toBe("Nicht verfügbar");
    expect(summary.personLines[0]?.article).toBe("Selank");
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
    expect(html).toContain("BESTELLUNGEN");
    expect(html).toContain("NAME");
    expect(html).toContain("DOSIS");
    expect(html).toContain("PepsiDry");
    expect(html).toContain("3 Kits");
    expect(html).toContain("10 mg");
    expect(html).not.toContain("CurrentProfile");
    expect(html).not.toContain("display_name");
    expect(html).not.toContain("1,25");
    expect(html).not.toContain("25 %");
  });

  it("does not print an empty merchant PDF", () => {
    const open = vi.fn();
    const original = window.open;
    window.open = open as typeof window.open;
    const createElement = vi.spyOn(document, "createElement");
    try {
      const result = printProcessingOrderSummary(buildProcessingOrderSummary([], []), "now");
      expect(result).toBeNull();
      expect(open).not.toHaveBeenCalled();
      expect(createElement).not.toHaveBeenCalled();
    } finally {
      window.open = original;
      createElement.mockRestore();
    }
  });

  it("creates a downloadable PDF file from processing orders", () => {
    const summary = buildProcessingOrderSummary(
      [makeOrder({ telegram_username_snapshot: "PepsiDry" })],
      [makeItem({ quantity: 3, line_total_usd: 150 })],
      [{ id: "prod-10", code: "RETA10", name: "Retatrutide 10 mg", category: "PEPTIDES" }],
    );
    const bytes = buildProcessingOrderSummaryPdf(summary, "03.09.2026, 10:00");
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("CHINA BESTELLUNG");
    expect(text).toContain("NUTZERNAME");
    expect(text).toContain("BESTELLUNGEN");
    expect(text).toContain("PRODUKT CODE");
    expect(text).toContain("MENGE");
    expect(text).toContain("GESAMTPREIS");
    expect(text).toContain("RETA10");
    expect(text).toContain("PepsiDry");
    expect(text).toContain("3 Kits");
    expect(text).toContain("GESAMT CHINA BESTELLUNG");
    expect(summary.customers[0]?.orderNumber).toBe("CN-2026-000034");
    expect(text).not.toContain("display_name");
    expect(text).not.toContain("1.25");
    expect(text).not.toContain("PEPTIDEBESTELLÜBERSICHT");
    expect(text).toContain("PRODUKTE");
    expect(text).not.toContain("GESAMTMENGE");
    expect((text.match(/\/Count (\d+)/) ?? [])[1]).toBe("2");
  });
});

describe("merchant quantity totals", () => {
  it("aggregates raw order items by product code, not display names or kit rows", () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      makeItem({
        id: `rt-${index}`,
        order_id: `order-${index}`,
        product_code_snapshot: "RT10",
        product_name_snapshot: "Retatrutide 10 mg",
        quantity: 2,
      }),
    );
    expect(aggregateMerchantQuantitiesByCode(items)).toEqual([{ code: "RT10", quantity: 20 }]);
  });

  it("never merges different product codes", () => {
    expect(
      aggregateMerchantQuantitiesByCode([
        makeItem({ id: "a", product_code_snapshot: "RT10", quantity: 2 }),
        makeItem({ id: "b", product_code_snapshot: "RT30", quantity: 2 }),
        makeItem({ id: "c", product_code_snapshot: "KP10", quantity: 15 }),
        makeItem({ id: "d", product_code_snapshot: "BA3", quantity: 8 }),
      ]),
    ).toEqual([
      { code: "BA3", quantity: 8 },
      { code: "KP10", quantity: 15 },
      { code: "RT10", quantity: 2 },
      { code: "RT30", quantity: 2 },
    ]);
  });

  it("keeps vendor-only AD10 separate from linked AD5 by product_code_snapshot", () => {
    expect(
      aggregateMerchantQuantitiesByCode([
        makeItem({ id: "ad5a", product_id: "master-ad5", product_code_snapshot: "AD5", quantity: 4 }),
        makeItem({ id: "ad10a", product_id: null, product_code_snapshot: "AD10", quantity: 6 }),
        makeItem({ id: "ad10b", product_id: null, product_code_snapshot: "AD10", quantity: 14 }),
        makeItem({ id: "ad5b", product_id: "master-ad5", product_code_snapshot: "AD5", quantity: 1 }),
      ]),
    ).toEqual([
      { code: "AD10", quantity: 20 },
      { code: "AD5", quantity: 5 },
    ]);
  });

  it("sums kit participant quantities from order items instead of complete-kit display lines", () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder({ id: `kit-${index}`, order_number: `CN-2026-0000${index}`, user_id: `user-${index}` }),
    );
    const items = orders.map((order, index) =>
      makeItem({
        id: `kit-item-${index}`,
        order_id: order.id,
        product_code_snapshot: "RT10",
        quantity: 2,
      }),
    );
    const summary = buildProcessingOrderSummary(orders, items);
    expect(summary.merchantTotals).toEqual([{ code: "RT10", quantity: 10 }]);
    expect(summary.merchantArticleCount).toBe(10);
    expect(summary.merchantTotals.some((row) => row.quantity === 1 && row.code === "RT10")).toBe(false);
  });

  it("exports exactly two pages for a normal order batch (orders + China purchase)", () => {
    const pdf = readFileSync(resolve(process.cwd(), "src/lib/pdf/peptixOrderSummaryPdf.ts"), "utf8");
    expect(pdf).toContain("CHINA BESTELLUNG");
    expect(pdf).toContain("NUTZERNAME");
    expect(pdf).toContain("PRODUKT CODE");
    expect(pdf).not.toContain("PEPTIDEBESTELLÜBERSICHT");
    expect(pdf).not.toContain("HÄNDLER GESAMTÜBERSICHT");
    expect(readFileSync(resolve(process.cwd(), "src/lib/orderSummaryExport.ts"), "utf8")).toContain(
      "buildPeptixOrderSummaryPdf",
    );

    const catalog = [{ id: "prod-10", code: "RT10", name: "Retatrutide 10 mg", category: "PEPTIDES", price_usd: 50 }];
    const summary = buildProcessingOrderSummary(
      [
        makeOrder({ id: "a", order_number: "CN-1" }),
        makeOrder({ id: "b", order_number: "CN-2", user_id: "user-2", telegram_username_snapshot: "Raff" }),
      ],
      [
        makeItem({ id: "i1", order_id: "a", product_code_snapshot: "RT10", quantity: 2, normal_price_usd_snapshot: 50, unit_price_usd_snapshot: 62.5 }),
        makeItem({ id: "i2", order_id: "b", product_code_snapshot: "RT10", quantity: 2, normal_price_usd_snapshot: 50, unit_price_usd_snapshot: 62.5 }),
      ],
      catalog,
    );
    const pages = planPeptixOrderSummaryPages(summary);
    expect(pages).toEqual(["BESTELLUNGEN", "CHINA BESTELLUNG"]);
    expect(summary.chinaPurchase.lines).toEqual([
      expect.objectContaining({ code: "RT10", quantity: 4, totalUsd: 200 }),
    ]);

    const bytes = buildProcessingOrderSummaryPdf(summary, "13.09.2026, 12:00");
    const text = new TextDecoder("latin1").decode(bytes);
    const count = text.match(/\/Count (\d+)/);
    expect(Number(count?.[1])).toBe(2);
    expect(text.indexOf("BESTELLUNGEN")).toBeGreaterThan(-1);
    expect(text.indexOf("CHINA BESTELLUNG")).toBeGreaterThan(text.indexOf("BESTELLUNGEN"));
    expect(text).toContain("GESAMT CHINA BESTELLUNG");
  });

  it("buildChinaPurchaseSummary uses catalog getEffectiveUnitPrice without customer markup", () => {
    const items = [
      makeItem({
        id: "a",
        product_code_snapshot: "CU50",
        quantity: 5,
        normal_price_usd_snapshot: 50,
        unit_price_usd_snapshot: 62.5,
        line_total_usd: 312.5,
      }),
      makeItem({
        id: "b",
        product_code_snapshot: "CU50",
        quantity: 6,
        normal_price_usd_snapshot: 50,
        unit_price_usd_snapshot: 62.5,
        line_total_usd: 375,
      }),
    ];
    const catalog = [
      {
        id: "prod-cu50",
        code: "CU50",
        name: "GHK-Cu",
        category: "PEPTIDES",
        price_usd: 40.5,
        bulk_price_usd: null,
        bulk_price_min_quantity: null,
      },
    ];
    const china = buildChinaPurchaseSummary(items, catalog);
    expect(china.lines).toHaveLength(1);
    expect(china.lines[0]?.quantity).toBe(11);
    expect(china.lines[0]?.quantityLabel).toBe("11 Kits");
    expect(china.lines[0]?.unitPriceUsd).toBe(40.5);
    expect(china.lines[0]?.totalUsd).toBe(445.5);
    expect(china.distinctProducts).toBe(1);
    expect(china.kitCount).toBe(11);
    expect(formatChinaPurchasePriceCells(china.lines[0]!).price).toContain("/ Kit");
  });

  it("applies bulk catalog pricing once for injectable oil totals", () => {
    const items = [
      makeItem({
        id: "oil",
        product_id: "oil-id",
        product_code_snapshot: "OXO50",
        product_name_snapshot: "Test Oil",
        quantity: 10,
        normal_price_usd_snapshot: 18,
        bulk_price_usd_snapshot: 160,
        bulk_price_min_quantity_snapshot: 10,
        unit_price_usd_snapshot: 20,
        line_total_usd: 200,
      }),
    ];
    const catalog = [
      {
        id: "oil-id",
        code: "OXO50",
        name: "Test Oil",
        category: "INJECTABLE OILS",
        price_usd: 18,
        bulk_price_usd: 160,
        bulk_price_min_quantity: 10,
      },
    ];
    const china = buildChinaPurchaseSummary(items, catalog);
    expect(china.lines[0]?.quantityLabel).toBe("10 Vials");
    expect(china.lines[0]?.totalUsd).toBe(160);
    expect(china.vialCount).toBe(10);
    expect(china.kitCount).toBe(0);
  });

  it("counts orals as packungen in the China quantity overview", () => {
    const items = [
      makeItem({
        id: "o1",
        product_code_snapshot: "SLU5",
        product_name_snapshot: "Oral A",
        quantity: 1,
        normal_price_usd_snapshot: 54,
        unit_price_usd_snapshot: 67.5,
      }),
      makeItem({
        id: "o2",
        product_code_snapshot: "BAM50",
        product_name_snapshot: "Oral B",
        quantity: 1,
        normal_price_usd_snapshot: 40,
        unit_price_usd_snapshot: 50,
      }),
    ];
    const catalog = [
      { id: "1", code: "SLU5", name: "Oral A", category: "ORALS", price_usd: 54 },
      { id: "2", code: "BAM50", name: "Oral B", category: "ORALS", price_usd: 40 },
    ];
    const china = buildChinaPurchaseSummary(items, catalog);
    expect(china.packungCount).toBe(2);
    expect(china.distinctProducts).toBe(2);
  });
});

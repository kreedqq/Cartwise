import { describe, expect, it } from "vitest";

import { buildAdminOrderItemsCsv, buildOrderCsv, buildOrderPrintHtml, buildOrdersListCsv, toOrderExportDoc } from "@/lib/orderExport";
import {
  ADMIN_WORKFLOW_STATUSES,
  canPermanentlyDeleteOrder,
  CUSTOMER_ORDER_COLUMNS,
  formatOrderTelegramSnapshot,
  nextOrderStatuses,
  ORDER_STATUS_LABELS,
  orderItemsToBulkLines,
  orderTelegramUsername,
} from "@/services/orders";
import type { Tables } from "@/types/database";

function makeOrder(overrides: Partial<Tables<"orders">> = {}): Tables<"orders"> {
  const now = new Date().toISOString();
  return {
    id: "order-1",
    order_number: "CW-2026-000001",
    user_id: "user-1",
    cart_id: "cart-1",
    status: "pending",
    note: "Bitte hier liefern",
    payment_method: null,
    telegram_username_snapshot: null,
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
    total_usd: 660,
    total_eur: 565.6,
    exchange_rate: 0.857,
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
    product_id: "prod-1",
    product_code_snapshot: "ART-5001",
    product_name_snapshot: "Produkt A",
    dosage_vial_snapshot: "10mg",
    description_snapshot: null,
    normal_price_usd_snapshot: 60,
    bulk_price_usd_snapshot: 55,
    bulk_price_min_quantity_snapshot: 10,
    applied_price_tier: "bulk",
    unit_price_usd_snapshot: 55,
    quantity: 12,
    line_total_usd: 660,
    exchange_rate_snapshot: 0.857,
    eur_value_snapshot: 565.6,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("nextOrderStatuses", () => {

  it("lets admins move completed orders back into the workflow", () => {
    expect(nextOrderStatuses("completed")).toEqual([
      "pending",
      "processing",
      "dispatched",
      "received",
      "shipped",
    ]);
    expect(nextOrderStatuses("cancelled")).toEqual(ADMIN_WORKFLOW_STATUSES);
  });

  it("only allows permanent delete of terminal orders", () => {
    expect(canPermanentlyDeleteOrder("completed")).toBe(true);
    expect(canPermanentlyDeleteOrder("cancelled")).toBe(true);
    expect(canPermanentlyDeleteOrder("pending")).toBe(false);
    expect(canPermanentlyDeleteOrder("processing")).toBe(false);
    expect(canPermanentlyDeleteOrder("confirmed")).toBe(false);
    expect(canPermanentlyDeleteOrder("dispatched")).toBe(false);
  });

  it("offers the six workflow statuses except the current one", () => {
    expect(nextOrderStatuses("pending")).toEqual([
      "processing",
      "dispatched",
      "received",
      "shipped",
      "completed",
    ]);
    expect(nextOrderStatuses("processing")).toEqual([
      "pending",
      "dispatched",
      "received",
      "shipped",
      "completed",
    ]);
    expect(nextOrderStatuses("confirmed")).toEqual(ADMIN_WORKFLOW_STATUSES);
  });

  it("exposes German labels for every status", () => {
    expect(ORDER_STATUS_LABELS.pending).toBe("Eingegangen");
    expect(ORDER_STATUS_LABELS.processing).toBe("In Bearbeitung");
    expect(ORDER_STATUS_LABELS.dispatched).toBe("Bestellung abgesendet");
    expect(ORDER_STATUS_LABELS.received).toBe("Bestellung Empfangen");
    expect(ORDER_STATUS_LABELS.shipped).toBe("Versendet");
    expect(ORDER_STATUS_LABELS.completed).toBe("Abgeschlossen");
    expect(ORDER_STATUS_LABELS.confirmed).toBe("Bestätigt");
    expect(ORDER_STATUS_LABELS.cancelled).toBe("Storniert");
  });
});

describe("order Telegram snapshot display", () => {
  it("returns the frozen snapshot and never a live profile username", () => {
    expect(orderTelegramUsername({ telegram_username_snapshot: "PepsiDry" })).toBe("PepsiDry");
    expect(formatOrderTelegramSnapshot({ telegram_username_snapshot: "PepsiDry" })).toBe("PepsiDry");
    expect(formatOrderTelegramSnapshot({ telegram_username_snapshot: "PepsiDry" })).not.toBe("CurrentProfile");
  });

  it("falls back to Nicht verfügbar when the snapshot is missing", () => {
    expect(orderTelegramUsername({ telegram_username_snapshot: null })).toBeNull();
    expect(orderTelegramUsername({ telegram_username_snapshot: "  " })).toBeNull();
    expect(formatOrderTelegramSnapshot({ telegram_username_snapshot: null })).toBe("Nicht verfügbar");
    expect(formatOrderTelegramSnapshot({})).toBe("Nicht verfügbar");
  });
});

describe("customer order columns", () => {
  it("maps order items to code+quantity lines for reorder at current prices", () => {
    expect(orderItemsToBulkLines([makeItem(), makeItem({ product_code_snapshot: "ART-5002", quantity: 5 })])).toEqual([
      { code: "ART-5001", quantity: 12 },
      { code: "ART-5002", quantity: 5 },
    ]);
  });

  it("never selects admin_note for customer order reads", () => {
    expect(CUSTOMER_ORDER_COLUMNS).not.toMatch(/admin_note/);
    expect(CUSTOMER_ORDER_COLUMNS.split(", ").sort()).toEqual(
      [
        "cart_id",
        "china_shipping_amount",
        "china_shipping_currency",
        "created_at",
        "de_shipping_amount",
        "de_shipping_currency",
        "exchange_rate",
        "id",
        "note",
        "order_number",
        "payment_method",
        "shipping_address_extra",
        "shipping_city",
        "shipping_country",
        "shipping_delivery_method",
        "shipping_first_name",
        "shipping_house_number",
        "shipping_last_name",
        "shipping_packstation_number",
        "shipping_post_number",
        "shipping_postal_code",
        "shipping_street",
        "status",
        "submitted_at",
        "telegram_username_snapshot",
        "total_eur",
        "total_usd",
        "updated_at",
        "user_id",
      ].sort(),
    );
  });
});

describe("order CSV / PDF snapshot source", () => {
  it("writes frozen snapshot prices, not live catalog values", () => {
    const csv = buildOrderCsv(toOrderExportDoc(makeOrder(), [makeItem()]));
    expect(csv).toContain("CW-2026-000001");
    expect(csv).toContain("Telegram Benutzername");
    expect(csv).toContain("Lieferadresse");
    expect(csv).toContain("ART-5001");
    expect(csv).toContain("Mengenpreis");
    expect(csv).toContain("55");
    expect(csv).toContain("660");
    expect(csv).not.toContain("admin");
    expect(csv).not.toContain("Intern");
    expect(csv).toContain("Versand aus China");
    expect(csv).toContain("Versand aus Deutschland");
    expect(csv).toContain("Gesamt Endpreis inkl. Versand");
  });

  it("includes a frozen role surcharge on admin export when snapshots exist", () => {
    const csv = buildOrderCsv(
      toOrderExportDoc(makeOrder(), [makeItem()], undefined, { catalogSubtotalUsd: 160, surchargeUsd: 40 }),
    );
    expect(csv).toContain("Zwischensumme USD");
    expect(csv).toContain("160");
    expect(csv).toContain("Rollenaufschlag USD");
    expect(csv).toContain("40");
  });

  it("does not invent a surcharge percent when no snapshot is provided", () => {
    const csv = buildOrderCsv(toOrderExportDoc(makeOrder(), [makeItem()]));
    expect(csv).not.toContain("Rollenaufschlag");
    expect(csv).not.toContain("25 %");
  });

  it("exports a filtered admin list", () => {
    const csv = buildOrdersListCsv([
      {
        order_number: "CW-2026-000002",
        status: "processing",
        submitted_at: "2026-08-27T08:00:00.000Z",
        total_usd: 420,
        total_eur: 360,
        customerLabel: "Ada",
        telegramUsername: "ExampleUser",
        deliveryMethodLabel: "Paketstation",
      },
    ]);
    expect(csv).toContain("CW-2026-000002");
    expect(csv).toContain("Ada");
    expect(csv).toContain("ExampleUser");
    expect(csv).toContain("Paketstation");
    expect(csv).toContain("In Bearbeitung");
    expect(csv).toContain("420");
  });

  it("exports admin line items with SKU, name, qty, prices, delivery and total", () => {
    const csv = buildAdminOrderItemsCsv([
      {
        order_number: "CW-2026-000045",
        submitted_at: "2026-09-01T08:00:00.000Z",
        telegramUsername: "ExampleUser",
        productCode: "OXO50",
        productName: "Anadrol",
        quantity: 10,
        unitPriceUsd: 20,
        lineTotalUsd: 200,
        deliveryMethodLabel: "Haustür Zustellung",
        roleSurchargeUsd: 40,
        orderTotalUsd: 200,
      },
    ]);
    expect(csv).toContain("Bestellnummer");
    expect(csv).toContain("CW-2026-000045");
    expect(csv).toContain("ExampleUser");
    expect(csv).toContain("OXO50");
    expect(csv).toContain("Anadrol");
    expect(csv).toContain("Haustür Zustellung");
    expect(csv).toContain("40");
    expect(csv).toContain("200");
  });

  it("builds a Bestellzusammenfassung PDF with article, delivery, address and surcharge", () => {
    const html = buildOrderPrintHtml(
      toOrderExportDoc(
        makeOrder({
          telegram_username_snapshot: "ExampleUser",
          shipping_delivery_method: "home",
          shipping_first_name: "Max",
          shipping_last_name: "Mustermann",
          shipping_street: "Musterstraße",
          shipping_house_number: "10",
          shipping_postal_code: "12345",
          shipping_city: "Hamburg",
          shipping_country: "Deutschland",
          total_usd: 200,
        }),
        [makeItem({ product_code_snapshot: "OXO50", product_name_snapshot: "Anadrol", quantity: 10, unit_price_usd_snapshot: 20, line_total_usd: 200 })],
        undefined,
        { catalogSubtotalUsd: 160, surchargeUsd: 40 },
        { audience: "admin" },
      ),
    );
    expect(html).toContain("BESTELLZUSAMMENFASSUNG");
    expect(html).toContain("OXO50");
    expect(html).toContain("ANADROL");
    expect(html).toContain("ExampleUser");
    expect(html).toContain("Haustür Zustellung");
    expect(html).toContain("Musterstraße");
    expect(html).toContain("Hamburg");
    expect(html).toContain("Zwischensumme");
    expect(html).toContain("Rollenaufschlag");
    expect(html).toContain("160,00");
    expect(html).toContain("40,00");
    expect(html).toContain("200,00");
    expect(html).not.toContain("1,25");
  });

  it("does not invent a surcharge on admin PDF when the snapshot is missing", () => {
    const html = buildOrderPrintHtml(toOrderExportDoc(makeOrder(), [makeItem()], undefined, null, { audience: "admin" }));
    expect(html).toContain("Rollenaufschlag nicht verfügbar");
    expect(html).not.toContain("25 %");
  });

  it("hides role surcharge on customer PDF even when no snapshot exists", () => {
    const html = buildOrderPrintHtml(toOrderExportDoc(makeOrder(), [makeItem()]));
    expect(html).not.toContain("Rollenaufschlag");
  });

  it("uses the same quantity labels in PDF as on the website", () => {
    const peptide = toOrderExportDoc(
      makeOrder(),
      [makeItem({ product_code_snapshot: "SK10", product_name_snapshot: "Selank", quantity: 5 })],
      undefined,
      null,
      { kitSizes: new Map([["prod-1", 10]]) },
    );
    expect(peptide.items[0]?.quantityLabel).toBe("5/10 Kit");
    expect(buildOrderPrintHtml(peptide)).toContain("5/10 Kit");

    const oil = toOrderExportDoc(
      makeOrder(),
      [makeItem({ product_id: "oil-1", product_code_snapshot: "TE300", product_name_snapshot: "TEST ENANTHATE", quantity: 5 })],
    );
    expect(oil.items[0]?.quantityLabel).toBe("5 Vials");
    expect(oil.items[0]?.quantityLabel).not.toContain("Kit");
    expect(buildOrderPrintHtml(oil)).toContain("5 Vials");

    const oral = toOrderExportDoc(
      makeOrder(),
      [makeItem({ product_id: "oral-1", product_code_snapshot: "OXO50", product_name_snapshot: "ANADROL", quantity: 5 })],
    );
    expect(oral.items[0]?.quantityLabel).toBe("5 Packungen");
    expect(buildOrderPrintHtml(oral)).toContain("5 Packungen");
  });
});

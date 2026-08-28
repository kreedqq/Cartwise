import { describe, expect, it } from "vitest";

import { buildOrderCsv, buildOrdersListCsv, toOrderExportDoc } from "@/lib/orderExport";
import {
  canPermanentlyDeleteOrder,
  CUSTOMER_ORDER_COLUMNS,
  nextOrderStatuses,
  ORDER_STATUS_LABELS,
  orderItemsToBulkLines,
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

  it("blocks transitions out of completed and cancelled", () => {
    expect(nextOrderStatuses("completed")).toEqual([]);
    expect(nextOrderStatuses("cancelled")).toEqual([]);
  });

  it("only allows permanent delete of terminal orders", () => {
    expect(canPermanentlyDeleteOrder("completed")).toBe(true);
    expect(canPermanentlyDeleteOrder("cancelled")).toBe(true);
    expect(canPermanentlyDeleteOrder("pending")).toBe(false);
    expect(canPermanentlyDeleteOrder("processing")).toBe(false);
    expect(canPermanentlyDeleteOrder("confirmed")).toBe(false);
  });

  it("allows every other status except the current one", () => {
    expect(nextOrderStatuses("pending")).toEqual(["processing", "cancelled"]);
    expect(nextOrderStatuses("processing")).toEqual(["confirmed", "cancelled"]);
    expect(nextOrderStatuses("confirmed")).toEqual(["completed", "cancelled"]);
  });

  it("exposes German labels for every status", () => {
    expect(ORDER_STATUS_LABELS.pending).toBe("Eingegangen");
    expect(ORDER_STATUS_LABELS.processing).toBe("In Bearbeitung");
    expect(ORDER_STATUS_LABELS.confirmed).toBe("Bestätigt");
    expect(ORDER_STATUS_LABELS.completed).toBe("Abgeschlossen");
    expect(ORDER_STATUS_LABELS.cancelled).toBe("Storniert");
  });

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
        "status",
        "submitted_at",
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

  it("exports a filtered admin list", () => {
    const csv = buildOrdersListCsv([
      {
        order_number: "CW-2026-000002",
        status: "processing",
        submitted_at: "2026-08-27T08:00:00.000Z",
        total_usd: 420,
        total_eur: 360,
        customerLabel: "Ada",
      },
    ]);
    expect(csv).toContain("CW-2026-000002");
    expect(csv).toContain("Ada");
    expect(csv).toContain("In Bearbeitung");
    expect(csv).toContain("420");
  });
});

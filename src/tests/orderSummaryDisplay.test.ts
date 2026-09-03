import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("admin Bestell Zusammenfassung", () => {
  it("adds the Bestell Zusammenfassung tab next to Eingegangene Bestellungen", () => {
    const nav = read("src/lib/adminNav.ts");
    expect(nav).toContain('label: "Bestell Zusammenfassung"');
    expect(nav).toContain('to: "/admin/order-summary"');
    expect(nav).toContain("Eingegangene Bestellungen");
    expect(nav.indexOf('label: "Versand"')).toBeLessThan(nav.indexOf('label: "Bestell Zusammenfassung"'));
    expect(read("src/App.tsx")).toContain('path="order-summary"');
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("Bestell Zusammenfassung");
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("Als PDF exportieren");
  });

  it("builds the list only from processing orders and existing snapshots", () => {
    const page = read("src/pages/admin/AdminOrderSummary.tsx");
    expect(page).toContain("buildProcessingOrderSummary");
    expect(page).toContain("useAdminOrders");
    expect(page).toContain("Keine Bestellungen in Bearbeitung");
    expect(page).toContain("disabled={summary.orderCount === 0}");
    expect(page).toContain("if (summary.orderCount === 0) return");
    expect(read("src/lib/orderExport.ts")).toContain("if (summary.orderCount === 0) return");
    expect(read("src/lib/orderSummary.ts")).toContain("line_total_usd");
    expect(read("src/lib/orderSummary.ts")).not.toContain("1.25");
    expect(read("src/lib/orderSummary.ts")).not.toContain("25 %");
    expect(page).not.toContain("profiles.username");
    expect(page).not.toContain("listMyOrders");
    expect(read("src/lib/orderSummary.ts")).toContain('PROCESSING_ORDER_STATUS: OrderStatus = "processing"');
    expect(read("src/lib/orderSummary.ts")).toContain("formatOrderTelegramSnapshot");
    expect(read("src/lib/orderSummary.ts")).not.toContain("from(\"profiles\")");
  });

  it("keeps the inbox order number and adds a status dropdown", () => {
    const inbox = read("src/pages/admin/AdminOrders.tsx");
    expect(inbox).toContain("{order.order_number}");
    expect(inbox).toContain("OrderStatusSelect");
    expect(inbox).toContain("ADMIN_WORKFLOW_STATUSES");
    expect(read("src/services/orders.ts")).toContain("Bestellung abgesendet");
    expect(inbox).not.toContain("profiles.username");
    const detail = read("src/pages/admin/AdminOrderDetail.tsx");
    expect(detail).toContain("{order.order_number}");
    expect(detail).toContain("OrderStatusSelect");
    expect(detail).toContain("useSetOrderStatus");
  });

  it("does not let the customer area load the admin summary or all orders", () => {
    expect(read("src/pages/Orders.tsx")).not.toMatch(/useAdminOrders|listAllOrders|order-summary/);
    expect(read("src/pages/OrderDetail.tsx")).not.toMatch(/useAdminOrders|listAllOrders|AdminOrderSummary/);
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).not.toContain("useMyOrders");
    const app = read("src/App.tsx");
    expect(app.indexOf("AdminRoute")).toBeLessThan(app.indexOf('path="order-summary"'));
    expect(read("src/lib/orderExport.ts")).not.toMatch(/supabase\.rpc\(/);
  });

  it("extends statuses without rewriting orders or loosening RLS", () => {
    const sql = read("supabase/migrations/0047_order_workflow_statuses.sql");
    expect(sql).toContain("dispatched");
    expect(sql).toContain("received");
    expect(sql).toContain("shipped");
    expect(sql).toContain("Existing order rows and order numbers are not rewritten");
    expect(sql).toMatch(/has_role\(auth\.uid\(\), 'admin'\)/);
    expect(sql).not.toMatch(/drop table public\.orders/i);
    expect(sql).not.toMatch(/update public\.orders\s+set status = '/i);
  });
});

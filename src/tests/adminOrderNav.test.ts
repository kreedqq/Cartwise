import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ADMIN_NAV_GROUPS } from "@/lib/adminNav";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("customer and admin order navigation", () => {
  it("labels the customer area Meine Bestellungen", () => {
    expect(read("src/lib/navigation.ts")).toContain('label: "Meine Bestellungen"');
    expect(read("src/components/layout/Sidebar.tsx")).toContain("Meine Bestellungen");
    expect(read("src/components/layout/MobileNavDrawer.tsx")).toContain("Meine Bestellungen");
    expect(read("src/components/layout/MobileNav.tsx")).toContain("Meine Bestellungen");
    expect(read("src/pages/Dashboard.tsx")).toContain("Meine Bestellungen");
    expect(read("src/pages/Orders.tsx")).toContain("Meine Bestellungen");
  });

  it("keeps the admin inbox on /admin/orders with the Eingegangene Bestellungen tab", () => {
    expect(read("src/lib/adminNav.ts")).toContain("Eingegangene Bestellungen");
    expect(read("src/pages/admin/AdminOrders.tsx")).toContain("Eingegangene Bestellungen");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("Eingegangene Bestellungen");
    expect(read("src/App.tsx")).toContain('path="orders"');
    expect(read("src/App.tsx")).toContain('path="/orders"');
  });

  it("does not let customer nav point at admin order inbox", () => {
    expect(read("src/lib/navigation.ts")).not.toMatch("/admin/orders");
    expect(read("src/components/layout/Sidebar.tsx")).not.toMatch("/admin/orders");
    expect(read("src/pages/Orders.tsx")).not.toMatch("/admin/orders");
  });
});

describe("hub admin navigation", () => {
  it("exposes only five main admin areas", () => {
    expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Übersicht",
      "Bestellungen",
      "Produkte",
      "Benutzer & Rollen",
      "Inhalte",
    ]);
  });

  it("keeps every existing admin destination as a hub or inner tab", () => {
    const destinations = [
      ...ADMIN_NAV_GROUPS.map((group) => group.to),
      ...ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to)),
    ];
    expect(destinations).toEqual(
      expect.arrayContaining([
        "/admin",
        "/admin/orders",
        "/admin/products",
        "/admin/pdf-import",
        "/admin/import-history",
        "/admin/users",
        "/admin/surcharges",
        "/admin/shipping",
        "/admin/order-summary",
        "/admin/audit-log",
        "/admin/research",
      ]),
    );
    expect(destinations).not.toContain("/admin/roles");
  });

  it("groups Bestellungen, Produkte, Benutzer & Rollen, and Inhalte as in-page tabs", () => {
    const orders = ADMIN_NAV_GROUPS.find((group) => group.id === "orders");
    expect(orders?.items.map((item) => item.label)).toEqual([
      "Eingegangene Bestellungen",
      "Versand",
      "Bestell Zusammenfassung",
    ]);
    const products = ADMIN_NAV_GROUPS.find((group) => group.id === "products");
    expect(products?.items.map((item) => item.label)).toEqual(["Produktkatalog", "Import", "Import-Verlauf"]);
    const users = ADMIN_NAV_GROUPS.find((group) => group.id === "users");
    expect(users?.items.map((item) => item.label)).toEqual([
      "Benutzer & Rollen",
      "Rollenaufschläge",
      "Audit-Log",
    ]);
    expect(users?.items.map((item) => item.label)).not.toContain("Benutzer");
    expect(users?.items.map((item) => item.label)).not.toContain("Rollen & Preisaufschlag");
    const content = ADMIN_NAV_GROUPS.find((group) => group.id === "content");
    expect(content?.items.map((item) => item.label)).toEqual(["Research"]);
  });

  it("renders hub links globally and section tabs on the page, wrapping on small screens", () => {
    const nav = read("src/components/layout/AdminNav.tsx");
    const layout = read("src/pages/admin/AdminLayout.tsx");
    expect(layout).toContain("AdminSectionTabs");
    expect(nav).toContain("flex-wrap");
    expect(nav).not.toContain("overflow-x-auto");
    expect(nav).not.toContain("LucideIcon");
  });

  it("keeps all previous admin routes in App.tsx", () => {
    const app = read("src/App.tsx");
    for (const path of [
      'path="orders"',
      'path="orders/:orderId"',
      'path="roles"',
      'path="surcharges"',
      'path="shipping"',
      'path="order-summary"',
      'path="products"',
      'path="pdf-import"',
      'path="import-history"',
      'path="users"',
      'path="audit-log"',
      'path="research"',
    ]) {
      expect(app).toContain(path);
    }
    expect(app).toContain("AdminRoute");
  });
});

describe("order authorization stays server-side", () => {
  it("keeps owner-or-admin SELECT and does not add a public PDF RPC", () => {
    const sql = read("supabase/migrations/0016_orders.sql");
    expect(sql).toMatch(/orders_select_own_or_admin/);
    expect(sql).toMatch(/user_id = auth\.uid\(\) or public\.has_role\(auth\.uid\(\), 'admin'\)/);
    expect(read("src/lib/orderExport.ts")).not.toMatch(/supabase\.rpc\(/);
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("printOrderDocument");
    expect(read("src/pages/OrderDetail.tsx")).toContain("printOrderDocument");
    expect(read("src/pages/admin/AdminOrderSummary.tsx")).toContain("downloadProcessingOrderSummaryPdf");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ADMIN_NAV_GROUPS, adminSectionForPath, adminTabIsActive } from "@/lib/adminNav";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("customer and admin order navigation", () => {
  it("labels the customer area Meine Bestellungen", () => {
    expect(read("src/lib/navigation.ts")).toContain('label: "Meine Bestellungen"');
    expect(read("src/components/layout/Sidebar.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/MobileNavDrawer.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/MobileNav.tsx")).toContain("useCustomerNavItems");
    expect(read("src/pages/Dashboard.tsx")).toContain("Meine Bestellungen");
    expect(read("src/pages/Orders.tsx")).toContain("Meine Bestellungen");
  });

  it("keeps the admin inbox on /admin/orders", () => {
    expect(read("src/pages/admin/AdminOrders.tsx")).toContain('title="Bestellungen"');
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("Bestellungen");
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
  it("exposes the commerce backoffice hubs in mental-model order", () => {
    expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Übersicht",
      "Bestellungen",
      "Warenkörbe",
      "Produkte",
      "Shop",
      "Kunden",
      "Design Studio",
      "Inhalte",
      "System",
    ]);
    expect(ADMIN_NAV_GROUPS[0]?.to).toBe("/admin");
  });

  it("keeps every existing admin destination as a hub or inner item", () => {
    const destinations = [
      ...ADMIN_NAV_GROUPS.map((group) => group.to),
      ...ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to.split("#")[0]!)),
    ];
    expect(destinations).toEqual(
      expect.arrayContaining([
        "/admin",
        "/admin/orders",
        "/admin/products",
        "/admin/products/create",
        "/admin/carts",
        "/admin/shop-areas",
        "/admin/users",
        "/admin/surcharges",
        "/admin/shipping-costs",
        "/admin/order-summary",
        "/admin/kit-requests",
        "/admin/audit-log",
        "/admin/system",
        "/admin/research",
        "/admin/announcements",
        "/admin/design-studio",
        "/admin/design-studio/portals",
        "/admin/design-studio/vials",
        "/admin/design-studio/categories",
        "/admin/feedback",
        "/admin/payment-methods",
        "/admin/pdf-import",
        "/admin/import-history",
      ]),
    );
    expect(destinations).not.toContain("/admin/roles");
  });

  it("groups Bestellungen and catalog functions under commerce hubs", () => {
    const orders = ADMIN_NAV_GROUPS.find((group) => group.id === "orders");
    expect(orders?.items.map((item) => item.label)).toEqual([
      "Bestellungen",
      "Kit Gesuche",
      "Bestellzusammenfassung",
      "Versand",
    ]);
    expect(orders?.items.map((item) => item.to)).toContain("/admin/kit-requests");

    const carts = ADMIN_NAV_GROUPS.find((group) => group.id === "carts");
    expect(carts?.to).toBe("/admin/carts");

    const products = ADMIN_NAV_GROUPS.find((group) => group.id === "products");
    expect(products?.items.map((item) => item.label)).toEqual([
      "Produkte",
      "Produkt anlegen",
      "Import",
      "Importverlauf",
    ]);

    const customers = ADMIN_NAV_GROUPS.find((group) => group.id === "customers");
    expect(customers?.items.map((item) => item.label)).toEqual([
      "Benutzer",
      "Rollen",
      "Rollenaufschläge",
    ]);

    const system = ADMIN_NAV_GROUPS.find((group) => group.id === "system");
    expect(system?.items.map((item) => item.label)).toEqual([
      "Zahlungsmethoden",
      "Wartung",
      "Audit Logs",
    ]);
  });

  it("resolves path sections without overlapping overview", () => {
    expect(adminSectionForPath("/admin")?.id).toBe("overview");
    expect(adminSectionForPath("/admin/orders")?.id).toBe("orders");
    expect(adminSectionForPath("/admin/kit-requests/abc")?.id).toBe("orders");
    expect(adminSectionForPath("/admin/payment-methods")?.id).toBe("system");
    expect(adminSectionForPath("/admin/shop-areas")?.id).toBe("shop");
    expect(adminSectionForPath("/admin/carts")?.id).toBe("carts");
    expect(adminTabIsActive("/admin/users", { to: "/admin/users", label: "Benutzer", matchPrefix: true })).toBe(
      true,
    );
    expect(
      adminTabIsActive("/admin/users", { to: "/admin/users#rollen", label: "Rollen" }, "#rollen"),
    ).toBe(true);
    expect(
      adminTabIsActive("/admin/users", { to: "/admin/users", label: "Benutzer", matchPrefix: true }, "#rollen"),
    ).toBe(false);
  });

  it("renders desktop sidebar and mobile drawer instead of chip hubs", () => {
    const nav = read("src/components/layout/AdminNav.tsx");
    // AdminShell now owns the chrome — AdminLayout is a thin re-export
    const shell = read("src/pages/admin/AdminShell.tsx");
    expect(shell).toContain("AdminSidebar");
    expect(shell).toContain("AdminMobileNav");
    expect(nav).toContain("AdminSidebar");
    expect(nav).toContain("readAdminNavCollapsed");
    expect(nav).not.toContain("overflow-x-auto");
    expect(read("src/lib/adminNav.ts")).toContain("localStorage");
  });

  it("keeps all previous admin routes in App.tsx", () => {
    const app = read("src/App.tsx");
    for (const path of [
      'path="orders"',
      'path="orders/:orderId"',
      'path="roles"',
      'path="surcharges"',
      'path="shipping"',
      'path="shipping/:orderId"',
      'path="shipping-costs"',
      'path="order-summary"',
      'path="kit-requests"',
      'path="products"',
      'path="shop-areas"',
      'path="pdf-import"',
      'path="import-history"',
      'path="users"',
      'path="audit-log"',
      'path="system"',
      'path="research"',
      'path="announcements"',
      'path="design"',
      'path="feedback"',
      'path="payment-methods"',
    ]) {
      expect(app).toContain(path);
    }
    expect(app).toContain("AdminRoute");
    expect(app).toContain('Navigate to="/admin/orders"');
    expect(app).toContain("RedirectAdminShippingOrder");
    expect(app).not.toContain("AdminShipmentCenterPage");
    expect(app).not.toContain("AdminShipmentManagePage");
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

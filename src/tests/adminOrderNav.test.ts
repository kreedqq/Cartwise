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

  it("labels the admin inbox Bestelleingänge and keeps the route", () => {
    expect(read("src/lib/adminNav.ts")).toContain("Bestelleingänge");
    expect(read("src/components/layout/AdminNav.tsx")).toContain("ADMIN_NAV_GROUPS");
    expect(read("src/pages/admin/AdminOrders.tsx")).toContain("Bestelleingänge");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("Bestelleingänge");
    expect(read("src/App.tsx")).toContain('path="orders"');
    expect(read("src/App.tsx")).toContain('path="/orders"');
  });

  it("does not let customer nav point at admin order inbox", () => {
    expect(read("src/lib/navigation.ts")).not.toMatch("/admin/orders");
    expect(read("src/components/layout/Sidebar.tsx")).not.toMatch("/admin/orders");
    expect(read("src/pages/Orders.tsx")).not.toMatch("/admin/orders");
  });
});

describe("grouped admin navigation", () => {
  it("keeps every existing admin destination", () => {
    const destinations = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to));
    expect(destinations).toEqual(
      expect.arrayContaining([
        "/admin",
        "/admin/orders",
        "/admin/products",
        "/admin/pdf-import",
        "/admin/import-history",
        "/admin/users",
        "/admin/roles",
        "/admin/surcharges",
        "/admin/shipping",
        "/admin/audit-log",
        "/admin/research",
      ]),
    );
  });

  it("groups products, finance, users, and content instead of one long tab row", () => {
    const labels = ADMIN_NAV_GROUPS.map((group) => group.label);
    expect(labels).toEqual(["Übersicht", "Bestellungen", "Produkte", "Finanzen", "Benutzer", "Inhalte"]);
    const products = ADMIN_NAV_GROUPS.find((group) => group.id === "products");
    expect(products?.items.map((item) => item.label)).toEqual(["Produktkatalog", "Import", "Import-Verlauf"]);
  });

  it("wraps on small screens instead of forcing a single overflowing tab row", () => {
    const nav = read("src/components/layout/AdminNav.tsx");
    expect(nav).toContain("flex-wrap");
    expect(nav).not.toContain("overflow-x-auto");
  });
});

describe("order authorization stays server-side", () => {
  it("keeps owner-or-admin SELECT and does not add a public PDF RPC", () => {
    const sql = read("supabase/migrations/0016_orders.sql");
    expect(sql).toMatch(/orders_select_own_or_admin/);
    expect(read("src/lib/orderExport.ts")).not.toMatch(/supabase\.rpc\(/);
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("printOrderDocument");
    expect(read("src/pages/OrderDetail.tsx")).toContain("printOrderDocument");
  });
});

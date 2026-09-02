import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("order number plus Telegram snapshot display", () => {
  it("keeps order_number as the primary admin inbox reference and shows the snapshot beside it", () => {
    const page = read("src/pages/admin/AdminOrders.tsx");
    expect(page).toContain("{order.order_number}");
    expect(page).toContain("formatOrderTelegramSnapshot");
    expect(page).toContain("Telegram Benutzername");
    expect(page).toContain("Telegram: {formatOrderTelegramSnapshot(order)}");
    expect(page).not.toContain("profiles.username");
    expect(page).not.toContain("display_name");
    expect(page).not.toContain("Interner Name");
  });

  it("shows Bestellung and Telegram Benutzername on China and Germany shipping", () => {
    const shipping = read("src/pages/admin/AdminShipping.tsx");
    expect(shipping).toContain("{order.order_number}");
    expect(shipping).toContain("formatOrderTelegramSnapshot");
    expect(shipping).toContain("Aktueller Versand aus China");
    expect(shipping).toMatch(/<TableHead>Bestellung<\/TableHead>/);
    expect(shipping).toContain("<TableHead>Telegram Benutzername</TableHead>");
    expect(shipping).toContain("<TableHead>Betrag</TableHead>");
    expect(shipping).toContain("<TableHead>Währung</TableHead>");
    expect(shipping).not.toContain("profiles.username");
    expect(shipping).not.toContain("display_name");
  });

  it("keeps the admin detail heading on the order number and labels the snapshot", () => {
    const detail = read("src/pages/admin/AdminOrderDetail.tsx");
    expect(detail).toContain("{order.order_number}");
    expect(detail).toContain("formatOrderTelegramSnapshot");
    expect(detail).toContain("Telegram Benutzername:");
    expect(detail.indexOf("{order.order_number}")).toBeLessThan(detail.indexOf("Telegram Benutzername:"));
    expect(detail).not.toContain("profiles.username");
  });

  it("keeps customer orders owner-scoped and still shows the order number", () => {
    const list = read("src/pages/Orders.tsx");
    const detail = read("src/pages/OrderDetail.tsx");
    expect(list).toContain("order.order_number");
    expect(list).toContain("OrderIdentity");
    expect(list).toContain("useMyOrders");
    expect(list).not.toMatch(/useAdminOrders|listAllOrders/);
    expect(detail).toContain("{order.order_number}");
    expect(detail).toContain("formatOrderTelegramSnapshot");
    expect(detail).toContain("useMyOrder");
    expect(detail).not.toMatch(/useAdminOrder|listAllOrders/);
  });

  it("reads only telegram_username_snapshot in the display helper", () => {
    const service = read("src/services/orders.ts");
    expect(service).toContain("telegram_username_snapshot");
    expect(service).toContain("Nicht verfügbar");
    const helper = service.slice(
      service.indexOf("export function orderTelegramUsername"),
      service.indexOf("export async function listMyOrders"),
    );
    expect(helper).not.toContain("from(\"profiles\")");
    expect(helper).not.toContain("display_name");
    expect(helper).not.toContain("getOwnProfile");
  });
});

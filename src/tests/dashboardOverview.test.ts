import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("customer dashboard cart overview", () => {
  it("shows compact clickable carts beside recent orders and removes quick order", () => {
    const page = read("src/pages/Dashboard.tsx");
    expect(page).toContain('filter((cart) => isOpenCart(cart.status))');
    expect(page).toContain("md:grid-cols-2");
    expect(page).toContain("Letzte Bestellungen");
    expect(page).toContain("CreateCartDialog");
    expect(page).toContain("Zum Shop");
    expect(page).toContain("Noch keine Warenkörbe vorhanden.");
    expect(page).not.toContain("QuickOrderCard");
    expect(page).not.toContain("Schnellbestellung");
    expect(page).not.toContain("Alle hinzufügen");
    expect(page).toContain("OrderTemplatesCard");
    expect(page).toContain("useMyOrders");
    expect(page).not.toMatch(/cartsQuery\.data\.map\(\(cart\)/);
  });

  it("opens the existing cart detail instead of listing cart lines on the dashboard", () => {
    const card = read("src/components/cart/CartCard.tsx");
    expect(card).toContain("const cartHref = `/carts/${cart.id}`");
    expect(card).toContain("<Link to={cartHref}");
    expect(card).toContain("Aktiver Warenkorb");
    expect(card).toContain("Positionen");
    expect(card).toContain("DualCurrencyPrice");
    expect(card).not.toContain("formatUsd");
    expect(card).toContain("handleDelete");
    expect(card).toContain("Öffnen");
    expect(card).not.toContain("CartItemsTable");
    expect(card).not.toContain("Gesamtmenge");
    expect(card).not.toContain("RenameCartDialog");
    expect(read("src/components/shop/QuickOrderCard.tsx")).toContain("Schnellbestellung");
  });
});

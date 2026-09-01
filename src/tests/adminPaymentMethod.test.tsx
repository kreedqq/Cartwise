import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaymentMethodBadge } from "@/components/orders/PaymentMethodBadge";

/**
 * Regression tests for: "Zahlungsmethode wird gespeichert, aber im Admin
 * nicht angezeigt."
 *
 * Root cause was NOT a missing query/column — `orders.payment_method` was
 * already fetched by both the customer and the admin order detail page
 * (`CUSTOMER_ORDER_COLUMNS` includes `payment_method`; the admin list uses `select("*")`).
 * It was a pure UI omission: neither `AdminOrders.tsx` nor
 * `AdminOrderDetail.tsx` ever rendered `order.payment_method` anywhere.
 */
function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("PaymentMethodBadge", () => {
  it.each([
    ["crypto", "Krypto"],
    ["paypal", "PayPal"],
    ["bank_transfer", "Überweisung"],
  ] as const)("renders the German label for %s", (method, label) => {
    render(<PaymentMethodBadge paymentMethod={method} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows 'Nicht angegeben' for null (older orders) instead of inventing a value", () => {
    render(<PaymentMethodBadge paymentMethod={null} />);
    expect(screen.getByText("Nicht angegeben")).toBeInTheDocument();
  });

  it("shows 'Nicht angegeben' for an unexpected/unknown value instead of crashing", () => {
    render(<PaymentMethodBadge paymentMethod="cash-on-delivery" />);
    expect(screen.getByText("Nicht angegeben")).toBeInTheDocument();
  });
});

describe("Admin order views surface the real orders.payment_method (no hardcoding)", () => {
  it("AdminOrderDetail renders PaymentMethodBadge from order.payment_method", () => {
    const tsx = readSource("src/pages/admin/AdminOrderDetail.tsx");
    expect(tsx).toMatch(/import \{ PaymentMethodBadge \} from "@\/components\/orders\/PaymentMethodBadge";/);
    expect(tsx).toMatch(/<PaymentMethodBadge paymentMethod=\{order\.payment_method\} \/>/);
  });

  it("AdminOrders list renders a PaymentMethodBadge column sourced from order.payment_method", () => {
    const tsx = readSource("src/pages/admin/AdminOrders.tsx");
    expect(tsx).toMatch(/import \{ PaymentMethodBadge \} from "@\/components\/orders\/PaymentMethodBadge";/);
    expect(tsx).toMatch(/<PaymentMethodBadge paymentMethod=\{order\.payment_method\} \/>/);
  });

  it("admin order list query already selects every column (payment_method included), so no query fix was needed", () => {
    const ts = readSource("src/services/orders.ts");
    expect(ts).toMatch(/export async function listAllOrders[\s\S]*?\.from\("orders"\)\.select\("\*"\)/);
  });

  it("customer and admin order detail columns include payment_method", () => {
    const ts = readSource("src/services/orders.ts");
    expect(ts).toMatch(/CUSTOMER_ORDER_COLUMNS =\s*\n?\s*"[^"]*payment_method[^"]*"/);
    expect(ts).toContain("getMyOrderWithItems");
    expect(ts).toContain("getAdminOrderWithItems");
  });
});

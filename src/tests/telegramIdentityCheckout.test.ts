import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Telegram Benutzername UI labels", () => {
  const files = [
    "src/pages/Register.tsx",
    "src/pages/Profile.tsx",
    "src/components/auth/RequireUsernameDialog.tsx",
    "src/pages/Checkout.tsx",
    "src/components/kit-requests/KitRequestCard.tsx",
    "src/pages/admin/AdminUsers.tsx",
    "src/components/orders/OrderShippingCard.tsx",
    "src/components/cart/CreateCartDialog.tsx",
  ];

  it("uses Telegram Benutzername in public identity surfaces", () => {
    for (const file of files) {
      expect(readSource(file), file).toContain("Telegram Benutzername");
    }
  });

  it("does not label the public handle as Anzeigename", () => {
    expect(readSource("src/pages/Register.tsx")).not.toContain("Anzeigename");
    expect(readSource("src/pages/Profile.tsx")).not.toContain("Anzeigename");
    expect(readSource("src/components/auth/RequireUsernameDialog.tsx")).not.toContain("Anzeigename");
    expect(readSource("src/pages/Checkout.tsx")).not.toContain("Anzeigename");
  });

  it("does not offer a free cart name field", () => {
    const dialog = readSource("src/components/cart/CreateCartDialog.tsx");
    expect(dialog).not.toContain("cart-name");
    expect(dialog).not.toContain("Warenkorb Name");
    const header = readSource("src/components/cart/CartHeader.tsx");
    expect(header).not.toContain("RenameCartDialog");
    const card = readSource("src/components/cart/CartCard.tsx");
    expect(card).not.toContain("RenameCartDialog");
    expect(card).not.toContain("Umbenennen");
  });
});

describe("0042 telegram identity carts and checkout", () => {
  const sql = readSource("supabase/migrations/0042_telegram_identity_carts_and_checkout.sql");

  it("assigns a stable name_ordinal and unique per user", () => {
    expect(sql).toMatch(/add column if not exists name_ordinal integer/);
    expect(sql).toMatch(/row_number\(\) over \(partition by user_id order by created_at asc, id asc\)/);
    expect(sql).toMatch(/create unique index if not exists carts_user_name_ordinal_uidx/);
  });

  it("rewrites every non-deleted cart title on username change, including ordered carts", () => {
    expect(sql).toMatch(/perform public\.sync_cart_titles_for_user\(_uid\)/);
    expect(sql).toMatch(/where user_id = _user_id\s+and deleted_at is null/);
    const syncFn = sql.slice(sql.indexOf("sync_cart_titles_for_user"), sql.indexOf("carts_assign_telegram_name"));
    expect(syncFn).not.toMatch(/status in \('draft', 'ready'\)/);
  });

  it("snapshots telegram username and shipping address on create_order", () => {
    expect(sql).toMatch(/telegram_username_snapshot/);
    expect(sql).toMatch(/shipping_street/);
    expect(sql).toMatch(/Bitte Vorname angeben/);
    expect(sql).toMatch(/Bitte zuerst einen Telegram Benutzernamen festlegen/);
  });

  it("keeps kit partial-order completion from 0039", () => {
    expect(sql).toMatch(/_kit\.status not in \('full', 'ordered'\)/);
    expect(sql).toMatch(/where kit_share_id = _kit_share_id and ordered_at is null/);
    expect(sql).toMatch(/if _remaining_unordered = 0 then/);
  });
});

describe("address privacy", () => {
  it("does not expose shipping columns in kit request SQL payloads", () => {
    const kitSql = readSource("supabase/migrations/0041_kit_requests.sql");
    expect(kitSql).not.toMatch(/shipping_/);
    expect(kitSql).not.toMatch(/telegram_username_snapshot/);
  });

  it("does not put shipping columns on carts", () => {
    const sql = readSource("supabase/migrations/0042_telegram_identity_carts_and_checkout.sql");
    const cartsSection = sql.slice(0, sql.indexOf("alter table public.orders"));
    expect(cartsSection).not.toMatch(/shipping_/);
  });

  it("customer order columns include own shipping snapshot but never admin_note", () => {
    const orders = readSource("src/services/orders.ts");
    expect(orders).toContain("shipping_street");
    expect(orders).toContain("telegram_username_snapshot");
    const columns = orders.match(/export const CUSTOMER_ORDER_COLUMNS =\s*"([^"]+)"/)?.[1] ?? "";
    expect(columns).toContain("shipping_street");
    expect(columns).not.toContain("admin_note");
  });
});

describe("checkout and auth race guards", () => {
  it("checkout validates address before create_order", () => {
    const checkout = readSource("src/pages/Checkout.tsx");
    expect(checkout).toContain("ShippingAddressFields");
    expect(checkout).toContain("shippingAddressSchema");
    expect(checkout).toContain("PaymentMethodSelector");
  });

  it("ProtectedRoute waits for auth loading before redirecting", () => {
    const route = readSource("src/routes/ProtectedRoute.tsx");
    expect(route).toContain("if (loading) return <FullScreenSpinner />");
    expect(route).toContain("if (session) return <Outlet />");
    expect(route).toContain('to="/login"');
  });

  it("login waits for session and honors a safe return path", () => {
    const login = readSource("src/pages/Login.tsx");
    expect(login).toContain("safePostLoginPath");
    expect(login).toContain("awaitingSession");
    expect(login).not.toMatch(/navigate\(POST_LOGIN_PATH/);
  });
});

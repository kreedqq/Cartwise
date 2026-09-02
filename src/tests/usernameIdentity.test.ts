import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("canonical username identity", () => {
  it("does not greet with an email prefix", () => {
    const dashboard = readSource("src/pages/Dashboard.tsx");
    expect(dashboard).toContain("visibleAccountLabel");
    expect(dashboard).not.toMatch(/email\?\.split\(/);
  });

  it("shows username in the topbar, not email", () => {
    const topbar = readSource("src/components/layout/Topbar.tsx");
    expect(topbar).toContain("visibleAccountLabel");
    expect(topbar).not.toMatch(/profile\?\.display_name \?\? user\?\.email/);
  });

  it("does not show Interner Name as a user identity in the UI", () => {
    expect(readSource("src/pages/Profile.tsx")).not.toContain("Interner Name");
    expect(readSource("src/pages/admin/AdminUsers.tsx")).not.toContain("Interner Name");
    expect(readSource("src/pages/admin/AdminRoles.tsx")).not.toContain("user.displayName");
    expect(readSource("src/pages/admin/AdminOrders.tsx")).toContain("orderTelegramUsername");
    expect(readSource("src/pages/admin/AdminOrders.tsx")).toContain("formatOrderTelegramSnapshot");
    expect(readSource("src/pages/admin/AdminOrders.tsx")).not.toContain("customer?.displayName");
    expect(readSource("src/pages/Profile.tsx")).toContain("Telegram Benutzername");
  });

  it("kit member list maps the username RPC column and never email", () => {
    const members = readSource("src/services/kitShareMembers.ts");
    expect(members).toContain("list_kit_share_members");
    expect(members).not.toMatch(/email/i);
  });

  it("shop cart creation does not invent a name from email", () => {
    const shopCart = readSource("src/hooks/useShopCart.ts");
    expect(shopCart).toContain("create.mutateAsync");
    expect(shopCart).not.toMatch(/email/);
    expect(shopCart).not.toMatch(/display_name/);
    expect(shopCart).not.toContain("defaultCartName");
  });
});

describe("0040 username cart names", () => {
  const sql = readSource("supabase/migrations/0040_username_cart_names.sql");

  it("names newly created kit carts after profiles.username", () => {
    expect(sql).toMatch(/select coalesce\(nullif\(trim\(username\), ''\), 'Warenkorb'\)/);
    expect(sql).toMatch(/values \(_user_id, _cart_name, 'draft', true\)/);
  });

  it("does not rewrite ordered carts when the username changes", () => {
    expect(sql).toMatch(/update public\.carts[\s\S]*status in \('draft', 'ready'\)/);
    expect(sql).toMatch(/name = 'Warenkorb'/);
  });

  it("kit share list still exposes username only, never email", () => {
    const kitSql = readSource("supabase/migrations/0038_username_and_kit_participant_removal.sql");
    expect(kitSql).toMatch(/p\.username as display_name/);
    expect(kitSql).toMatch(/never real name\/display_name\/email/);
  });
});

describe("0042 cart titles follow the current Telegram handle", () => {
  const sql = readSource("supabase/migrations/0042_telegram_identity_carts_and_checkout.sql");

  it("derives cart titles from profiles.username and a frozen ordinal", () => {
    expect(sql).toMatch(/create or replace function public\.cart_title/);
    expect(sql).toMatch(/trim\(_username\) \|\| ' – Warenkorb ' \|\| _ordinal::text/);
  });

  it("rewrites ordered and archived carts when the handle changes", () => {
    expect(sql).toContain("Rewrites every non-deleted cart title from the stable ordinal");
    expect(sql).toMatch(/and deleted_at is null/);
  });
});

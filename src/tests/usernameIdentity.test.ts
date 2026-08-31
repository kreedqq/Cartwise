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

  it("kit member list maps the username RPC column and never email", () => {
    const members = readSource("src/services/kitShareMembers.ts");
    expect(members).toContain("list_kit_share_members");
    expect(members).not.toMatch(/email/i);
  });

  it("shop cart creation uses defaultCartName from username", () => {
    const shopCart = readSource("src/hooks/useShopCart.ts");
    expect(shopCart).toContain("defaultCartName");
    expect(shopCart).not.toMatch(/name: "Warenkorb"/);
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

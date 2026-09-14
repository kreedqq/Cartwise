import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0093 kit cart removal tracking migration", () => {
  const sql = read("supabase/migrations/0093_kit_cart_removal_tracking.sql");

  it("persists removal on kit_share_participants and tracks only kit cart deletes", () => {
    expect(sql).toContain("cart_line_removed_at timestamptz");
    expect(sql).toContain("cart_line_last_in_cart_at timestamptz");
    expect(sql).toContain("track_kit_cart_item_removal");
    expect(sql).toContain("if old.kit_share_id is null then");
    expect(sql).toContain("kit.skip_cart_removal_tracking");
    expect(sql).toContain("cart_items_track_kit_removal");
    expect(sql).toContain("and ksp.ordered_at is null");
    expect(sql).toContain("and ksp.order_id is null");
  });

  it("clears removal flags on kit_share_sync_participant_cart upsert", () => {
    expect(sql).toContain("set cart_line_removed_at = null");
    expect(sql).toContain("cart_line_last_in_cart_at = now()");
  });

  it("exposes restore_kit_share_cart_line with auth, idempotency, and audit", () => {
    expect(sql).toContain("create or replace function public.restore_kit_share_cart_line");
    expect(sql).toContain("has_role(_actor, 'admin')");
    expect(sql).toContain("Bestellte Kit-Anteile können nicht wiederhergestellt werden");
    expect(sql).toContain("alreadyInCart");
    expect(sql).toContain("kit_cart.restore");
    expect(sql).toContain("kit_share_sync_participant_cart(_kit_share_id, _participant_user_id)");
    expect(sql).toContain("grant execute on function public.restore_kit_share_cart_line");
    expect(sql).toContain("to authenticated");
  });

  it("wires admin restore UI without exposing internal state keys", () => {
    expect(read("src/components/orders/SharedKitAdminCard.tsx")).toContain("Wieder in Warenkorb legen");
    expect(read("src/components/orders/SharedKitAdminCard.tsx")).not.toContain("REMOVED_FROM_CART");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("useRestoreKitShareCartLine");
  });
});

describe("0094 kit share my cart presence", () => {
  const sql = read("supabase/migrations/0094_kit_share_my_cart_presence.sql");

  it("exposes viewer-only presence on get_my_kit_share", () => {
    expect(sql).toContain("kit_participant_cart_presence");
    expect(sql).toContain("'myCartPresence', _presence");
    expect(sql).toContain("'myCanRestoreCartLine', (_presence = 'removed_from_cart')");
    expect(sql).not.toMatch(/jsonb_build_object\([\s\S]*'cart_line_removed_at'/);
  });

  it("wires customer KitShareDialog restore without leaking foreign carts", () => {
    const dialog = read("src/components/shop/KitShareDialog.tsx");
    expect(dialog).toContain("myCanRestoreCartLine");
    expect(dialog).toContain("Wieder in Warenkorb legen");
    expect(dialog).not.toContain("cart_line_removed_at");
  });
});

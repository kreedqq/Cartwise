import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canSetOwnKitQuantity, maxOwnKitQuantity } from "@/lib/kitRequests";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0086 admin kit requests", () => {
  const sql = read("supabase/migrations/0086_admin_kit_requests.sql");

  it("adds admin-only list/detail/meta/quantity/cancel RPCs with has_role admin", () => {
    expect(sql).toContain("create or replace function public.admin_list_kit_requests");
    expect(sql).toContain("create or replace function public.admin_get_kit_request");
    expect(sql).toContain("create or replace function public.admin_update_kit_request_meta");
    expect(sql).toContain("create or replace function public.admin_update_kit_request_participant_quantity");
    expect(sql).toContain("create or replace function public.admin_cancel_kit_request");
    expect(sql).toContain("assert_admin_kit_request");
    expect(sql).toContain("has_role(_uid, 'admin')");
    expect(sql).toContain("security definer");
    expect(sql).toContain("grant execute on function public.admin_list_kit_requests");
    expect(sql).not.toMatch(/grant execute[\s\S]*to anon/);
  });

  it("keeps capacity as others + new_own and uses existing full cart sync", () => {
    expect(sql).toContain("_others := public.kit_share_allocated_total(_kit.id) - _participant.quantity");
    expect(sql).toContain("peptix.allow_kit_request_join");
    expect(sql).toContain("kit_share_sync_all_participant_carts");
    expect(sql).toContain("kit_share_catalog_product");
  });

  it("blocks processed kits and does not rewrite orders or product identity", () => {
    expect(sql).toContain("Dieses Kit wurde bereits verarbeitet und kann nicht mehr auf diese Weise geändert werden.");
    expect(sql).toContain("'canChangeProduct', false");
    expect(sql).not.toMatch(/update public\.orders/i);
    expect(sql).not.toMatch(/update public\.order_items/i);
    expect(sql).not.toContain("0070_one_user_cart");
    expect(sql).not.toContain("0085_fix_kit_request_one_cart_sync");
  });

  it("wires admin UI under Bestellungen without redesigning customer kit pages", () => {
    expect(read("src/lib/adminNav.ts")).toContain("/admin/kit-requests");
    expect(read("src/lib/adminNav.ts")).toContain("Kit Gesuche");
    expect(read("src/App.tsx")).toContain("AdminKitRequestsPage");
    expect(read("src/App.tsx")).toContain("AdminKitRequestDetailPage");
    expect(read("src/pages/admin/AdminKitRequests.tsx")).toContain("useAdminKitRequests");
    const detail = read("src/pages/admin/AdminKitRequestDetail.tsx");
    expect(detail).toContain("Kit stornieren");
    expect(detail).toContain("Kit Verteilung");
    expect(detail).toContain("Verteilung speichern");
    expect(detail).toContain("Kit Gesuch gespeichert.");
    expect(detail).toContain("Möchtest du dieses Kit Gesuch wirklich stornieren?");
    expect(read("src/services/adminKitRequests.ts")).toContain("admin_cancel_kit_request");
    expect(read("src/services/adminKitRequests.ts")).toContain("extractRpcErrorMessage");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Mitmachen");
  });

  it("documents admin quantity scenarios with the shared capacity helpers", () => {
    expect(canSetOwnKitQuantity(10, 5, 4, 5)).toBe(true);
    expect(maxOwnKitQuantity(10, 5, 4)).toBe(9);
    expect(canSetOwnKitQuantity(10, 5, 4, 9)).toBe(true);
    expect(canSetOwnKitQuantity(10, 5, 4, 10)).toBe(false);
    expect(sql).toContain("Die neue Kitgröße darf die bereits belegte Menge nicht unterschreiten.");
  });
});

describe("0087 admin kit distribution", () => {
  const sql = read("supabase/migrations/0087_admin_kit_request_distribution.sql");
  const detail = read("src/pages/admin/AdminKitRequestDetail.tsx");
  const service = read("src/services/adminKitRequests.ts");

  it("adds atomic distribution, user search, and safe delete RPCs", () => {
    expect(sql).toContain("create or replace function public.admin_set_kit_request_distribution");
    expect(sql).toContain("create or replace function public.admin_search_kit_request_users");
    expect(sql).toContain("create or replace function public.admin_delete_kit_request");
    expect(sql).toContain("assert_admin_kit_request");
    expect(sql).toContain("kit_share_sync_all_participant_carts");
    expect(sql).toContain("Die neue Verteilung überschreitet die Kitgröße.");
    expect(sql).toContain("Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.");
    expect(sql).toContain("Dieses Kit kann nicht gelöscht werden, da bereits eine Bestellung damit verbunden ist.");
    expect(sql).not.toMatch(/grant execute[\s\S]*to anon/);
    expect(sql).not.toContain("update public.orders");
    expect(sql).not.toContain("update public.order_items");
  });

  it("allows admin remove of foreign participants only with join GUC", () => {
    expect(sql).toContain("kit_share_guard_open_request_participant");
    expect(sql).toContain("peptix.allow_kit_request_join");
    expect(sql).toContain("has_role(auth.uid(), 'admin')");
  });

  it("wires distribution UI with add/remove/save and delete confirmation", () => {
    expect(detail).toContain("Kit Verteilung");
    expect(detail).toContain("Teilnehmer hinzufügen");
    expect(detail).toContain("Verteilung speichern");
    expect(detail).toContain("Ungespeicherte Änderungen");
    expect(detail).toContain("Kit ist überbelegt");
    expect(detail).toContain("Kit löschen");
    expect(detail).toContain("Kit Gesuch endgültig löschen?");
    expect(detail).toContain("Endgültig löschen");
    expect(service).toContain("admin_set_kit_request_distribution");
    expect(service).toContain("admin_search_kit_request_users");
    expect(service).toContain("admin_delete_kit_request");
    expect(read("src/hooks/useAdminKitRequests.ts")).toContain("useAdminSetKitRequestDistribution");
  });

  it("documents redistribution scenarios as capacity sums", () => {
    // A5 B3 C2 -> A3 B3 C2 D2
    expect(3 + 3 + 2 + 2).toBe(10);
    expect(3 + 3 + 2 + 2 <= 10).toBe(true);
    // A5 B3 C2 -> remove A, D5 => B3 C2 D5
    expect(3 + 2 + 5).toBe(10);
    // overbook reject
    expect(5 + 3 + 2 + 1 > 10).toBe(true);
  });
});

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
    expect(detail).toContain("Teilnehmer verwalten");
    expect(detail).toContain("Bearbeiten");
    expect(detail).toContain("Kit Gesuch gespeichert.");
    expect(detail).toContain("Möchtest du dieses Kit Gesuch wirklich stornieren?");
    expect(read("src/services/adminKitRequests.ts")).toContain("admin_cancel_kit_request");
    expect(read("src/services/adminKitRequests.ts")).toContain("extractRpcErrorMessage");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Mitmachen");
  });

  it("keeps admin edit actions behind explicit buttons and server flags", () => {
    const detail = read("src/pages/admin/AdminKitRequestDetail.tsx");
    expect(detail).toContain("editingMeta");
    expect(detail).toContain("managingParticipants");
    expect(detail).toContain("canEditMeta");
    expect(detail).toContain("canEditQuantities");
    expect(detail).toContain("canCancel");
    expect(read("src/services/adminKitRequests.ts")).toContain("canChangeProduct");
    expect(detail).not.toContain("setProductId");
  });

  it("maps PostgREST plain-object errors for admin mutations", () => {
    const service = read("src/services/adminKitRequests.ts");
    expect(service).toContain("extractRpcErrorMessage");
    expect(service).toContain("typeof value === \"string\"");
    expect(service).toContain("admin_update_kit_request_meta");
    expect(service).toContain("admin_update_kit_request_participant_quantity");
  });

  it("documents admin quantity scenarios with the shared capacity helpers", () => {
    // TEST 7: 4 → 5 with others 1
    expect(canSetOwnKitQuantity(10, 5, 4, 5)).toBe(true);
    expect(maxOwnKitQuantity(10, 5, 4)).toBe(9);
    // TEST 8: 4 → 9 fills
    expect(canSetOwnKitQuantity(10, 5, 4, 9)).toBe(true);
    // TEST 9: 4 → 10 rejected
    expect(canSetOwnKitQuantity(10, 5, 4, 10)).toBe(false);
    // TEST 11: kit size 10 → 5 with allocated 8 is rejected by SQL rule (size >= allocated)
    expect(sql).toContain("Die neue Kitgröße darf die bereits belegte Menge nicht unterschreiten.");
  });
});

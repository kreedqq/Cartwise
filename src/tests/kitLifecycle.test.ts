import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isValidCreatorQuantity, isValidJoinQuantity, remainingQuantityOptions } from "@/lib/kitRequests";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("kit request lifecycle stays on the existing engine", () => {
  it("prevents overbooking on a 10er kit", () => {
    expect(isValidCreatorQuantity(10, 3)).toBe(true);
    expect(isValidJoinQuantity(7, 4)).toBe(true);
    expect(isValidJoinQuantity(3, 3)).toBe(true);
    expect(isValidJoinQuantity(3, 4)).toBe(false);
    expect(remainingQuantityOptions(3)).toEqual([1, 2, 3]);
    expect(3 + 4 + 4).toBeGreaterThan(10);
    expect(3 + 4 + 3).toBe(10);
  });

  it("does not sync carts when an open request is created", () => {
    const wizard = read("src/components/kit-requests/CreateKitRequestDialog.tsx");
    expect(wizard).toContain("useCreateKitRequest");
    expect(wizard).not.toContain("sync_completed_kit_request_carts");
    expect(wizard).not.toContain("create_kit_share");
    expect(read("supabase/migrations/0072_kit_request_catalog_identity.sql")).not.toContain(
      "sync_completed_kit_request_carts",
    );
  });

  it("joins through preview + join and syncs only when full", () => {
    const join = read("src/components/kit-requests/JoinKitRequestDialog.tsx");
    const sql = read("supabase/migrations/0041_kit_requests.sql");
    expect(join).toContain("previewKitRequestJoin");
    expect(join).toContain("useJoinKitRequest");
    expect(sql).toContain("for update");
    expect(sql).toMatch(/if _allocated = _kit\.kit_size_vials then/);
    expect(sql).toContain("kit_share_sync_all_participant_carts");
    expect(sql).toContain("Nicht genügend Vials verfügbar");
  });

  it("keeps shop create on CreateKitRequestDialog", () => {
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("CreateKitRequestDialog");
    expect(read("src/components/shop/ShopProductsMobileList.tsx")).toContain("CreateKitRequestDialog");
    expect(read("src/components/shop/ShopProductsTable.tsx")).not.toMatch(/<KitShareDialog/);
  });
});

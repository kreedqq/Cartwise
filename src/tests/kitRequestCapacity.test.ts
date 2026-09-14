import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  canSetOwnKitQuantity,
  kitRequestFailureMessage,
  KIT_REQUEST_MUTATION_FAILED_MESSAGE,
  maxOwnKitQuantity,
  otherParticipantsQuantity,
  ownQuantityOptions,
  remainingQuantityOptions,
} from "@/lib/kitRequests";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("kit quantity capacity (own vs others)", () => {
  it("TEST2/11: own 4, others 1 → max own 9 and increase to 5 allowed", () => {
    expect(otherParticipantsQuantity(5, 4)).toBe(1);
    expect(maxOwnKitQuantity(10, 5, 4)).toBe(9);
    expect(canSetOwnKitQuantity(10, 5, 4, 5)).toBe(true);
    expect(ownQuantityOptions(10, 5, 4)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("TEST3: own 4, others 1 → increase to 9 fills kit", () => {
    expect(canSetOwnKitQuantity(10, 5, 4, 9)).toBe(true);
  });

  it("TEST4: own 4, others 1 → 10 rejected", () => {
    expect(canSetOwnKitQuantity(10, 5, 4, 10)).toBe(false);
  });

  it("TEST5: reduce 4 → 2 allowed", () => {
    expect(canSetOwnKitQuantity(10, 5, 4, 2)).toBe(true);
  });

  it("TEST6: own 4, others 6 → 5 rejected", () => {
    expect(canSetOwnKitQuantity(10, 10, 4, 5)).toBe(false);
  });

  it("TEST7: own 4, others 5 → 5 allowed (fills)", () => {
    expect(canSetOwnKitQuantity(10, 9, 4, 5)).toBe(true);
    expect(maxOwnKitQuantity(10, 9, 4)).toBe(5);
  });

  it("TEST8: own 4, others 5 → 6 rejected", () => {
    expect(canSetOwnKitQuantity(10, 9, 4, 6)).toBe(false);
  });

  it("new join uses remaining only (own=0)", () => {
    expect(maxOwnKitQuantity(10, 9, 0)).toBe(1);
    expect(remainingQuantityOptions(1)).toEqual([1]);
    expect(ownQuantityOptions(10, 9, 0)).toEqual([1]);
  });
});

describe("0085 kit request one-cart sync fix", () => {
  const sql = read("supabase/migrations/0085_fix_kit_request_one_cart_sync.sql");

  it("rejects retail kits by kit/item area, not carts.shop_area", () => {
    expect(sql).toContain("create or replace function public.reject_retail_kit_cart_item");
    expect(sql).toContain("from public.kit_shares");
    expect(sql).toContain("NEW.shop_area");
    expect(sql).toContain("shop_area_pricing_profile");
    expect(sql).not.toMatch(/select shop_area into _area\s+from public\.carts where id = NEW\.cart_id/);
  });

  it("keeps capacity as others + new_own and allows open-request quantity updates", () => {
    expect(sql).toContain("_others := public.kit_share_allocated_total(_kit_share_id) - _participant.quantity");
    expect(sql).toContain("peptix.allow_kit_request_join");
    expect(sql).toContain("Marketplace: cart lines only when the request becomes full");
    expect(sql).toContain("kit_share_catalog_product");
  });

  it("does not rewrite 0070 or historical orders", () => {
    expect(sql).not.toContain("0070_one_user_cart");
    expect(sql).not.toMatch(/update public\.orders/i);
    expect(sql).not.toMatch(/delete from public\.kit_shares/i);
  });
});

describe("kit request failure logging", () => {
  it("logs PostgREST plain objects with operation without changing customer toast", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const postgrest = {
      message: "Kits sind in diesem Shop-Bereich nicht verfügbar.",
      code: "P0001",
      details: null,
      hint: null,
    };
    expect(kitRequestFailureMessage(postgrest, "join_kit_request")).toBe(KIT_REQUEST_MUTATION_FAILED_MESSAGE);
    expect(spy).toHaveBeenCalledWith(
      "[peptix:kit]",
      expect.objectContaining({
        operation: "join_kit_request",
        code: "P0001",
        message: "Kits sind in diesem Shop-Bereich nicht verfügbar.",
      }),
    );
    spy.mockRestore();
  });
});

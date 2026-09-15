import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canOrderKitShare } from "@/lib/shop/kitShare";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/** Mirrors `kit_share_refresh_status_locked` (0100+) status assignment. */
export function deriveKitShareRowStatus(
  allocated: number,
  kitSizeVials: number,
): "open" | "full" {
  if (allocated > kitSizeVials) {
    throw new Error("overflow");
  }
  if (allocated === kitSizeVials) {
    return "full";
  }
  return "open";
}

/** Mirrors SQL `cart_kit_share_is_checkout_ready` (0088 / 0097). */
export function cartKitShareIsCheckoutReady(input: {
  kitStatus: string;
  kitAllocatedTotal: number;
  kitSizeVials: number;
  participantQuantity: number;
  cartQuantity: number;
  participantOrderedAt: string | null;
}): boolean {
  const {
    kitStatus,
    kitAllocatedTotal,
    kitSizeVials,
    participantQuantity,
    cartQuantity,
    participantOrderedAt,
  } = input;
  if (participantOrderedAt != null) return false;
  if (kitStatus !== "full" && kitStatus !== "ordered") return false;
  if (kitAllocatedTotal !== kitSizeVials) return false;
  return participantQuantity === cartQuantity;
}

describe("kit status vs participant sum (SSoT refresh_status_locked)", () => {
  it("maps join → OPEN when sum < size", () => {
    expect(deriveKitShareRowStatus(5, 10)).toBe("open");
    expect(canOrderKitShare(10, [{ quantity: 5 }])).toBe(false);
  });

  it("maps join → FULL when sum = size (10-rule)", () => {
    expect(deriveKitShareRowStatus(10, 10)).toBe("full");
    expect(canOrderKitShare(10, [{ quantity: 5 }, { quantity: 5 }])).toBe(true);
  });

  it("maps leave / quantity decrease → OPEN when sum drops below size", () => {
    expect(deriveKitShareRowStatus(9, 10)).toBe("open");
    expect(deriveKitShareRowStatus(4, 10)).toBe("open");
  });

  it("never allows sum > size in refresh path", () => {
    expect(() => deriveKitShareRowStatus(11, 10)).toThrow("overflow");
  });

  it("OPEN + SUM = SIZE maps to full (0100)", () => {
    expect(deriveKitShareRowStatus(10, 10)).toBe("full");
    expect(deriveKitShareRowStatus(20, 20)).toBe("full");
  });
});

describe("checkout-ready vs kit FULL (four distinct states)", () => {
  it("requires row status full|ordered — not allocation alone (fail closed on desync)", () => {
    const sumEqualsSize = deriveKitShareRowStatus(10, 10);
    expect(sumEqualsSize).toBe("full");

    const desyncOpen: typeof sumEqualsSize = "open";
    expect(
      cartKitShareIsCheckoutReady({
        kitStatus: desyncOpen,
        kitAllocatedTotal: 10,
        kitSizeVials: 10,
        participantQuantity: 5,
        cartQuantity: 5,
        participantOrderedAt: null,
      }),
    ).toBe(false);
  });

  it("checkout-ready needs participant qty = cart qty", () => {
    expect(
      cartKitShareIsCheckoutReady({
        kitStatus: "full",
        kitAllocatedTotal: 10,
        kitSizeVials: 10,
        participantQuantity: 5,
        cartQuantity: 3,
        participantOrderedAt: null,
      }),
    ).toBe(false);
  });

  it("ordered participant is never checkout-ready again", () => {
    expect(
      cartKitShareIsCheckoutReady({
        kitStatus: "full",
        kitAllocatedTotal: 10,
        kitSizeVials: 10,
        participantQuantity: 5,
        cartQuantity: 5,
        participantOrderedAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("kit FULL + participant + matching cart line → checkout-ready", () => {
    expect(
      cartKitShareIsCheckoutReady({
        kitStatus: "full",
        kitAllocatedTotal: 10,
        kitSizeVials: 10,
        participantQuantity: 5,
        cartQuantity: 5,
        participantOrderedAt: null,
      }),
    ).toBe(true);
  });

  it("checkout rejects OPEN + SUM = SIZE (fail closed on status)", () => {
    expect(
      cartKitShareIsCheckoutReady({
        kitStatus: "open",
        kitAllocatedTotal: 10,
        kitSizeVials: 10,
        participantQuantity: 5,
        cartQuantity: 5,
        participantOrderedAt: null,
      }),
    ).toBe(false);
  });

  it("checkout rejects FULL when kit sum != size", () => {
    expect(
      cartKitShareIsCheckoutReady({
        kitStatus: "full",
        kitAllocatedTotal: 9,
        kitSizeVials: 10,
        participantQuantity: 5,
        cartQuantity: 5,
        participantOrderedAt: null,
      }),
    ).toBe(false);
  });

  it("without a cart line checkout never runs — SQL gate only sees existing cart_items", () => {
    expect(
      cartKitShareIsCheckoutReady({
        kitStatus: "full",
        kitAllocatedTotal: 10,
        kitSizeVials: 10,
        participantQuantity: 5,
        cartQuantity: 0,
        participantOrderedAt: null,
      }),
    ).toBe(false);
  });
});

describe("0100 kit state hardening migration (static)", () => {
  const hardeningSql = read("supabase/migrations/0100_kit_state_hardening.sql");
  const lockSql = read("supabase/migrations/0097_kit_share_customer_lock.sql");

  it("refresh_status_locked derives full from sum = kit_size (0100)", () => {
    expect(hardeningSql).toMatch(/when _allocated = _kit\.kit_size_vials then 'full'/);
    expect(hardeningSql).toContain("kit_share_sync_all_participant_carts");
  });

  it("cart_kit_share_is_checkout_ready requires allocation = kit_size", () => {
    expect(hardeningSql).toMatch(/kit_share_allocated_total\(_kit_share_id\) = ks\.kit_size_vials/);
    expect(hardeningSql).toMatch(/ks\.status in \('full', 'ordered'\)/);
  });

  it("sync_all skips ordered participants and sets skip_customer_lock", () => {
    expect(hardeningSql).toMatch(/ordered_at is null/);
    expect(hardeningSql).toMatch(/kit\.skip_customer_lock/);
  });

  it("sync_participant uses kit_share_id only for existing line lookup", () => {
    expect(hardeningSql).toMatch(/and ci\.kit_share_id = _kit_share_id\s*\n\s*limit 1/s);
  });

  it("open marketplace kits skip cart lines until full", () => {
    expect(hardeningSql).toMatch(/is_open_request, false\) and _kit\.status <> 'full'/);
  });

  it("join path syncs all carts only when kit becomes full", () => {
    const joinSql = read("supabase/migrations/0041_kit_requests.sql");
    expect(joinSql).toMatch(/if _allocated = _kit\.kit_size_vials then/);
    expect(joinSql).toContain("kit_share_sync_all_participant_carts");
  });

  it("0097 blocks customer leave/qty when lock active; sync uses skip GUC", () => {
    expect(lockSql).toContain("kit_share_assert_customer_may_mutate");
    expect(lockSql).toContain("kit_share_sync_participant_cart");
    expect(lockSql).toMatch(/create or replace function public\.leave_kit_share/);
    expect(lockSql).toMatch(/perform public\.kit_share_refresh_status_locked/);
  });

  it("restore_kit_share_cart_line reuses sync when cart_line_removed_at set", () => {
    const restoreSql = read("supabase/migrations/0095_fix_kit_cart_restore_audit.sql");
    expect(restoreSql).toContain("kit_share_sync_participant_cart");
    expect(restoreSql).toMatch(/cart_line_removed_at is null/);
  });
});

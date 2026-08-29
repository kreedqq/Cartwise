import { describe, it, expect, vi, beforeEach } from "vitest";

import { ConcurrencyError } from "@/lib/errors";
import type { Tables } from "@/types/database";

/**
 * Minimal chainable fake for the subset of the supabase-js query builder that
 * mergeDuplicateCartItems actually uses:
 *   .from("cart_items").update(patch).eq(id).eq(version).select().maybeSingle()
 *   .from("cart_items").delete().in("id", ids)
 *
 * Both call chains share one object (methods don't collide), which keeps the
 * mock small while still letting each test configure its own result.
 */
function buildChain(updateResult: { data: unknown; error: unknown }, deleteResult: { error: unknown }) {
  const chain = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(updateResult)),
    in: vi.fn(() => Promise.resolve(deleteResult)),
  };
  return chain;
}

let updateResult: { data: unknown; error: unknown };
let deleteResult: { error: unknown };
let chain: ReturnType<typeof buildChain>;

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => chain),
  },
}));

const { mergeDuplicateCartItems } = await import("@/services/cartItems");

function makeItem(overrides: Partial<Tables<"cart_items">>): Tables<"cart_items"> {
  const now = new Date().toISOString();
  return {
    id: "item",
    cart_id: "cart-1",
    position: 0,
    product_id: "prod-1",
    product_code_input: "ART-1",
    product_code_snapshot: "ART-1",
    product_name_snapshot: "Testprodukt",
    quantity: 5,
    unit_price_usd_snapshot: 60,
    normal_price_usd_snapshot: 60,
    bulk_price_usd_snapshot: 55,
    bulk_price_min_quantity_snapshot: 10,
    applied_price_tier: "normal",
    exchange_rate_snapshot: 1.1,
    eur_value_snapshot: null,
    price_snapshot_at: now,
    resolution_status: "resolved",
    note: null,
    kit_share_id: null,
    version: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("mergeDuplicateCartItems", () => {
  beforeEach(() => {
    updateResult = { data: null, error: null };
    deleteResult = { error: null };
    chain = buildChain(updateResult, deleteResult);
  });

  it("sums quantities, re-selects the bulk tier (5 + 7 -> 12 -> bulk), and deletes the duplicate rows", async () => {
    const keep = makeItem({ id: "keep", position: 0, quantity: 5, version: 3 });
    const dup = makeItem({ id: "dup", position: 1, quantity: 7, version: 1 });

    updateResult.data = { ...keep, quantity: 12, unit_price_usd_snapshot: 55, applied_price_tier: "bulk" };

    await mergeDuplicateCartItems([dup, keep]);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 12, unit_price_usd_snapshot: 55, applied_price_tier: "bulk" }),
    );
    expect(chain.in).toHaveBeenCalledWith("id", ["dup"]);
  });

  it("keeps the normal price when the merged quantity stays under the bulk threshold", async () => {
    const keep = makeItem({ id: "keep", position: 0, quantity: 2, version: 1 });
    const dup = makeItem({ id: "dup", position: 1, quantity: 3, version: 1 });

    updateResult.data = { ...keep, quantity: 5, unit_price_usd_snapshot: 60, applied_price_tier: "normal" };

    await mergeDuplicateCartItems([dup, keep]);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 5, unit_price_usd_snapshot: 60, applied_price_tier: "normal" }),
    );
  });

  /**
   * Regression test: mergeDuplicateCartItems must go through the same
   * optimistic-locking check (.select().maybeSingle(), throw when no row
   * comes back) as every other cart_items write. Before this fix, a
   * concurrent edit to the surviving row between load and merge would match
   * zero rows *without* a Postgrest error, and the duplicate rows would
   * still be deleted below - silently losing their quantity instead of
   * folding it into `keep`.
   */
  it("throws ConcurrencyError and does NOT delete the duplicates when the keep row changed concurrently", async () => {
    const keep = makeItem({ id: "keep", position: 0, quantity: 5, version: 3 });
    const dup = makeItem({ id: "dup", position: 1, quantity: 7, version: 1 });

    updateResult.data = null; // version mismatch: zero rows matched, no error

    await expect(mergeDuplicateCartItems([dup, keep])).rejects.toBeInstanceOf(ConcurrencyError);
    expect(chain.delete).not.toHaveBeenCalled();
    expect(chain.in).not.toHaveBeenCalled();
  });

  it("is a no-op for fewer than two items", async () => {
    const keep = makeItem({ id: "keep" });
    await mergeDuplicateCartItems([keep]);
    expect(chain.update).not.toHaveBeenCalled();
    expect(chain.delete).not.toHaveBeenCalled();
  });
});

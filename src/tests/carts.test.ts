import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ConcurrencyError } from "@/lib/errors";
import { isOpenCart, pickActiveOpenCart } from "@/services/carts";
import type { Tables } from "@/types/database";

function buildChain(updateResult: { data: unknown; error: unknown }) {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(updateResult)),
  };
  return chain;
}

let updateResult: { data: unknown; error: unknown };
let chain: ReturnType<typeof buildChain>;

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => chain),
  },
}));

const { softDeleteCart } = await import("@/services/carts");

describe("isOpenCart", () => {
  it("treats draft and ready as editable carts", () => {
    expect(isOpenCart("draft")).toBe(true);
    expect(isOpenCart("ready")).toBe(true);
    expect(isOpenCart("archived")).toBe(true);
    expect(isOpenCart("ordered")).toBe(false);
  });
});

describe("pickActiveOpenCart", () => {
  const userA = "user-a";
  const userB = "user-b";

  function cart(partial: Partial<Tables<"carts">> & Pick<Tables<"carts">, "id">): Tables<"carts"> {
    return {
      id: partial.id,
      user_id: partial.user_id ?? userA,
      name: partial.name ?? "Cart",
      name_ordinal: partial.name_ordinal ?? 1,
      status: partial.status ?? "draft",
      note: partial.note ?? null,
      is_active_cart: partial.is_active_cart ?? false,
      version: partial.version ?? 1,
      deleted_at: partial.deleted_at ?? null,
      created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
      updated_at: partial.updated_at ?? "2026-01-01T00:00:00Z",
    };
  }

  it("returns the active open cart for the signed-in user", () => {
    const carts = [
      cart({ id: "old-ordered", is_active_cart: true, status: "ordered" }),
      cart({ id: "active-open", is_active_cart: true, status: "draft" }),
    ];
    expect(pickActiveOpenCart(carts, userA)?.id).toBe("active-open");
  });

  it("ignores another user's active cart from stale cache", () => {
    const carts = [cart({ id: "foreign", user_id: userB, is_active_cart: true, status: "draft" })];
    expect(pickActiveOpenCart(carts, userA)).toBeNull();
  });

  it("ignores deleted carts", () => {
    const carts = [
      cart({ id: "deleted", is_active_cart: true, deleted_at: "2026-01-02T00:00:00Z", status: "draft" }),
    ];
    expect(pickActiveOpenCart(carts, userA)).toBeNull();
  });
});

describe("softDeleteCart", () => {
  beforeEach(() => {
    updateResult = { data: { id: "cart-1" }, error: null };
    chain = buildChain(updateResult);
  });

  it("soft-deletes an open cart and never targets ordered carts", async () => {
    await softDeleteCart("cart-1");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active_cart: false, deleted_at: expect.any(String) }),
    );
    expect(chain.eq).toHaveBeenCalledWith("id", "cart-1");
    expect(chain.neq).toHaveBeenCalledWith("status", "ordered");
  });

  it("refuses when the cart is already submitted", async () => {
    updateResult.data = null;
    await expect(softDeleteCart("cart-ordered")).rejects.toThrow(/Abgeschickte Bestellungen/);
  });
});

describe("ordered cart SQL lock", () => {
  it("locks customer updates and deletes on ordered carts", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0023_reconstitution_water_and_ordered_cart_lock.sql"),
      "utf8",
    );
    expect(sql).toMatch(/status <> 'ordered'/);
    expect(sql).toMatch(/carts_update_own/);
    expect(sql).toMatch(/carts_delete_own/);
    expect(sql).toContain("RECONSTITUTION-WATER");
    expect(sql).toContain("bac water");
    expect(sql).toContain("aa water");
    expect(sql).not.toMatch(/create or replace function public\.list_shop_products/);
  });

  it("keeps cart_items writes blocked after submit", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0016_orders.sql"), "utf8");
    expect(sql).toMatch(/c\.status <> 'ordered'/);
  });

  it("keeps customer order tables SELECT-only", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0018_order_write_lock.sql"), "utf8");
    expect(sql).toContain("revoke insert, update, delete on public.orders from authenticated");
    expect(sql).toContain("grant select on public.orders to authenticated");
    expect(sql).toContain("revoke insert, update, delete on public.order_items from authenticated");
  });
});

describe("ConcurrencyError still used for optimistic cart writes", () => {
  it("exists", () => {
    expect(new ConcurrencyError().name).toBe("ConcurrencyError");
  });
});

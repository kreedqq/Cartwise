import { describe, expect, it, vi, beforeEach } from "vitest";

function buildChain(deleteResult: { error: unknown }) {
  const chain = {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => Promise.resolve(deleteResult)),
  };
  return chain;
}

let deleteResult: { error: unknown };
let chain: ReturnType<typeof buildChain>;

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => chain),
  },
}));

const { deleteCartItem } = await import("@/services/cartItems");

describe("deleteCartItem", () => {
  beforeEach(() => {
    deleteResult = { error: null };
    chain = buildChain(deleteResult);
  });

  it("removes a single line by id from an open cart", async () => {
    await deleteCartItem("item-b");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "item-b");
  });

  it("surfaces a database error instead of swallowing it", async () => {
    deleteResult.error = { message: "new row violates row-level security", code: "42501" };
    await expect(deleteCartItem("item-b")).rejects.toMatchObject({ code: "42501" });
  });
});

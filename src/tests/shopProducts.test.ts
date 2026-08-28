import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}));

const { listShopProducts, resolveProductByCode } = await import("@/services/products");

const SHOP_ROW = {
  id: "prod-1",
  code: "ART-100",
  name: "Test",
  description: null,
  category: null,
  price_usd: 125,
  currency: "USD",
  is_active: true,
  last_price_change_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  dosage_vial: null,
  bulk_price_usd: 112.5,
  bulk_price_min_quantity: 10,
};

describe("listShopProducts", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it("loads active products through list_shop_products, never a direct products table select", async () => {
    rpc.mockResolvedValue({ data: [SHOP_ROW], error: null });
    const rows = await listShopProducts();
    expect(rpc).toHaveBeenCalledWith("list_shop_products");
    expect(from).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.price_usd).toBe(125);
    expect(rows[0]).not.toHaveProperty("markup_percent");
  });

  it("treats a successful empty RPC as empty, not as a hidden error", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(listShopProducts()).resolves.toEqual([]);
  });

  it("surfaces the RPC error so the shop error state can render", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Returned type numeric does not match expected type numeric(12,4) in column 6." },
    });
    await expect(listShopProducts()).rejects.toMatchObject({ message: expect.stringContaining("numeric(12,4)") });
  });
});

describe("resolveProductByCode", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("uses get_shop_product_by_code and does not send a client markup", async () => {
    rpc.mockResolvedValue({ data: SHOP_ROW, error: null });
    const result = await resolveProductByCode("art-100");
    expect(rpc).toHaveBeenCalledWith("get_shop_product_by_code", { _code: "ART-100" });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("markup");
    expect(result.status).toBe("resolved");
    expect(result.product?.price_usd).toBe(125);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: vi.fn(),
  },
}));

const { createOrder, deleteOrder, setOrderStatus } = await import("@/services/orders");

describe("createOrder RPC", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("sends cart id and note and trusts the server total", async () => {
    rpc.mockResolvedValue({
      data: { orderId: "ord-9", orderNumber: "CW-2026-000009", totalUsd: 660 },
      error: null,
    });
    const result = await createOrder("cart-1", "Bitte schnell");
    expect(rpc).toHaveBeenCalledWith("create_order", { _cart_id: "cart-1", _note: "Bitte schnell" });
    expect(result).toEqual({ orderId: "ord-9", orderNumber: "CW-2026-000009", totalUsd: 660 });
  });

  it("never sends a client-invented total", async () => {
    rpc.mockResolvedValue({
      data: { orderId: "ord-9", orderNumber: "CW-2026-000009", totalUsd: 12 },
      error: null,
    });
    const result = await createOrder("cart-1", null);
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual({ _cart_id: "cart-1", _note: null });
    expect(payload).not.toHaveProperty("unit_price");
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("markup");
    expect(result.totalUsd).toBe(12);
  });
});

describe("setOrderStatus RPC", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("sends status through the admin-gated RPC, never a direct table update", async () => {
    rpc.mockResolvedValue({ data: { id: "ord-9", status: "processing" }, error: null });
    await setOrderStatus("ord-9", "processing", "Intern prüfen");
    expect(rpc).toHaveBeenCalledWith("set_order_status", {
      _order_id: "ord-9",
      _status: "processing",
      _admin_note: "Intern prüfen",
    });
  });
});

describe("deleteOrder RPC", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("sends only the order id through the admin-gated RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await deleteOrder("ord-9");
    expect(rpc).toHaveBeenCalledWith("delete_order", { _order_id: "ord-9" });
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("total");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: vi.fn(),
  },
}));

const { createOrder, deleteOrder, setOrderStatus } = await import("@/services/orders");

const HOME_SHIPPING = {
  deliveryMethod: "home" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  street: "Example Street",
  houseNumber: "10",
  postalCode: "10115",
  city: "Berlin",
  country: "Deutschland",
};

describe("createOrder RPC", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("sends cart id, note, and payment method and trusts the server total", async () => {
    rpc.mockResolvedValue({
      data: { orderId: "ord-9", orderNumber: "CW-2026-000009", totalUsd: 660 },
      error: null,
    });
    const result = await createOrder("cart-1", "Bitte schnell", "paypal", HOME_SHIPPING);
    expect(rpc).toHaveBeenCalledWith("create_order", {
      _cart_id: "cart-1",
      _note: "Bitte schnell",
      _payment_method: "paypal",
      _shipping_delivery_method: "home",
      _shipping_first_name: "Ada",
      _shipping_last_name: "Lovelace",
      _shipping_street: "Example Street",
      _shipping_house_number: "10",
      _shipping_address_extra: null,
      _shipping_packstation_number: null,
      _shipping_post_number: null,
      _shipping_postal_code: "10115",
      _shipping_city: "Berlin",
      _shipping_country: "Deutschland",
    });
    expect(result).toEqual({ orderId: "ord-9", orderNumber: "CW-2026-000009", totalUsd: 660 });
  });

  it("never sends a client-invented total", async () => {
    rpc.mockResolvedValue({
      data: { orderId: "ord-9", orderNumber: "CW-2026-000009", totalUsd: 12 },
      error: null,
    });
    const result = await createOrder("cart-1", null, "crypto", HOME_SHIPPING);
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload._cart_id).toBe("cart-1");
    expect(payload._note).toBeNull();
    expect(payload._payment_method).toBe("crypto");
    expect(payload._shipping_street).toBe("Example Street");
    expect(payload).not.toHaveProperty("unit_price");
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("markup");
    expect(result.totalUsd).toBe(12);
    expect(payload).not.toHaveProperty("unitPriceUsd");
    expect(payload).not.toHaveProperty("lineTotal");
  });

  it("trusts the server total for oils qty 10 (16 × 10 = 160), never a client 1600", async () => {
    rpc.mockResolvedValue({
      data: { orderId: "ord-oil", orderNumber: "CW-2026-000160", totalUsd: 160 },
      error: null,
    });
    const result = await createOrder("cart-oil", null, "crypto", HOME_SHIPPING);
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("totalUsd");
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("unit_price");
    expect(result.totalUsd).toBe(160);
    expect(result.totalUsd).not.toBe(1600);
  });

  it("sends Packstation fields and omits street for that delivery type", async () => {
    rpc.mockResolvedValue({
      data: { orderId: "ord-ps", orderNumber: "CW-2026-000010", totalUsd: 200 },
      error: null,
    });
    await createOrder("cart-1", null, "crypto", {
      deliveryMethod: "packstation",
      firstName: "Ada",
      lastName: "Lovelace",
      packstationNumber: "139",
      postNumber: "123456",
      postalCode: "10115",
      city: "Berlin",
      country: "Deutschland",
    });
    expect(rpc).toHaveBeenCalledWith(
      "create_order",
      expect.objectContaining({
        _shipping_delivery_method: "packstation",
        _shipping_packstation_number: "139",
        _shipping_post_number: "123456",
        _shipping_street: null,
        _shipping_house_number: null,
      }),
    );
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("total");
    expect(payload).not.toHaveProperty("markup");
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

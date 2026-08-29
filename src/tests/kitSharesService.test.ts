import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

const {
  addKitShareToCart,
  assertKitSharePricePrivacy,
  createKitShare,
  inviteKitShareParticipant,
  updateKitShareQuantity,
} = await import("@/services/kitShares");

const sampleView = {
  id: "kit-1",
  productId: "prod-1",
  productName: "Masteron",
  productCode: "D100",
  kitSizeVials: 10,
  status: "full" as const,
  allocatedTotal: 10,
  remainingVials: 0,
  myQuantity: 3,
  myPriceUsd: 90,
  canAddToCart: true,
  participants: [
    { isSelf: true, displayName: "Du", quantity: 3 },
    { isSelf: false, displayName: "Teilnehmer", quantity: 7 },
  ],
};

describe("kitShares service", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("creates kit share via RPC", async () => {
    rpc.mockResolvedValue({ data: sampleView, error: null });
    const view = await createKitShare("prod-1", 10, 3);
    expect(rpc).toHaveBeenCalledWith("create_kit_share", {
      _product_id: "prod-1",
      _kit_size_vials: 10,
      _my_quantity: 3,
    });
    expect(view.myQuantity).toBe(3);
    expect(view.myPriceUsd).toBe(90);
  });

  it("invites participant via RPC", async () => {
    rpc.mockResolvedValue({ data: sampleView, error: null });
    await inviteKitShareParticipant("kit-1", "user-b", 7);
    expect(rpc).toHaveBeenCalledWith("invite_kit_share_participant", {
      _kit_share_id: "kit-1",
      _participant_user_id: "user-b",
      _quantity: 7,
    });
  });

  it("updates own quantity via RPC", async () => {
    rpc.mockResolvedValue({ data: { ...sampleView, myQuantity: 4, myPriceUsd: 120 }, error: null });
    const view = await updateKitShareQuantity("kit-1", 4);
    expect(rpc).toHaveBeenCalledWith("update_kit_share_quantity", {
      _kit_share_id: "kit-1",
      _quantity: 4,
    });
    expect(view.myQuantity).toBe(4);
  });

  it("adds kit share to cart via RPC with only kit share id", async () => {
    rpc.mockResolvedValue({ data: "cart-item-1", error: null });
    const cartItemId = await addKitShareToCart("kit-1");
    expect(rpc).toHaveBeenCalledWith("add_kit_share_to_cart", { _kit_share_id: "kit-1" });
    expect(cartItemId).toBe("cart-item-1");
  });

  it("surfaces add_kit_share_to_cart SQL column errors from production regression", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "42703",
        message: 'column "exchange_rate" does not exist',
        details: null,
        hint: null,
      },
    });
    await expect(addKitShareToCart("kit-1")).rejects.toMatchObject({
      code: "42703",
      message: expect.stringContaining("exchange_rate"),
    });
  });

  it("add to cart uses participant quantity not full kit size", async () => {
    rpc.mockResolvedValue({ data: "cart-item-1", error: null });
    await addKitShareToCart("kit-1");
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual({ _kit_share_id: "kit-1" });
    expect(payload).not.toHaveProperty("quantity");
    expect(payload).not.toHaveProperty("product_id");
    expect(payload).not.toHaveProperty("price");
  });
});

describe("assertKitSharePricePrivacy", () => {
  it("allows only myPriceUsd in payload", () => {
    expect(() => assertKitSharePricePrivacy(sampleView)).not.toThrow();
  });

  it("rejects foreign price fields", () => {
    const badView = {
      ...sampleView,
      participants: [{ isSelf: false, displayName: "Max", quantity: 7, priceUsd: 210 }],
    } as typeof sampleView & { participants: Array<{ priceUsd?: number }> };
    expect(() => assertKitSharePricePrivacy(badView as never)).toThrow(/Preisfelder/);
  });

  it("does not expose other participant prices in serialized payload", () => {
    const payload = JSON.stringify(sampleView);
    expect(payload).not.toMatch(/210/);
    expect(payload).toContain('"myPriceUsd":90');
  });
});

describe("kit allocation scenarios (client helpers)", () => {
  it("3 + 7 = 10 is valid full kit", async () => {
    rpc.mockResolvedValue({
      data: { ...sampleView, allocatedTotal: 10, remainingVials: 0, status: "full" },
      error: null,
    });
    const view = await createKitShare("prod-1", 10, 3);
    expect(view.allocatedTotal).toBe(10);
    expect(view.remainingVials).toBe(0);
    expect(view.status).toBe("full");
  });

  it("surfaces RPC overflow errors", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar." },
    });
    await expect(inviteKitShareParticipant("kit-1", "user-c", 1)).rejects.toEqual({
      message: "Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar.",
    });
  });
});

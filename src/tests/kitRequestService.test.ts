import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

const { createKitRequest, joinKitRequest, mapKitRequestCard, previewKitRequestJoin, syncCompletedKitRequestCarts } =
  await import("@/services/kitRequests");

const sampleCard = {
  id: "req-1",
  productId: "prod-1",
  productName: "SLU-PP-332",
  productCode: "SLU05",
  variantLabel: "5 mg",
  category: "peptides",
  creatorUsername: "testuser",
  kitSizeVials: 10,
  allocatedTotal: 4,
  remainingVials: 6,
  creatorQuantity: 4,
  myQuantity: 0,
  myUnitPriceUsd: 18,
  myPriceUsd: null,
  isCreator: false,
  isParticipant: false,
  status: "open",
  createdAt: "2026-08-31T00:00:00.000Z",
  expiresAt: null,
  completedAt: null,
  note: null,
};

describe("kitRequests service mapping", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("maps a public card without exposing private identity fields", () => {
    const view = mapKitRequestCard(sampleCard);
    expect(view.creatorUsername).toBe("testuser");
    expect(view.myUnitPriceUsd).toBe(18);
    expect(JSON.stringify(view)).not.toMatch(/email|display_name|markup/i);
  });

  it("rejects a payload that includes another participant's price", () => {
    expect(() => mapKitRequestCard({ ...sampleCard, otherPriceUsd: 9 })).toThrow(/Preisfeld/);
  });

  it("sends join quantity to join_kit_request", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        kitRequestId: "req-1",
        myQuantity: 2,
        remainingQuantity: 4,
        status: "open",
        myPriceUsd: 36,
        myUnitPriceUsd: 18,
        cartSynced: false,
      },
      error: null,
    });
    const result = await joinKitRequest("req-1", 2);
    expect(rpc).toHaveBeenCalledWith("join_kit_request", { _kit_share_id: "req-1", _quantity: 2 });
    expect(result.myQuantity).toBe(2);
    expect(result.cartSynced).toBe(false);
  });

  it("creates an open request without calling cart sync", async () => {
    rpc.mockResolvedValue({ data: sampleCard, error: null });
    const card = await createKitRequest({
      productId: "prod-1",
      kitSizeVials: 10,
      myQuantity: 3,
      shopArea: "group_buy_1",
    });
    expect(rpc).toHaveBeenCalledWith("create_kit_request", {
      _product_id: "prod-1",
      _kit_size_vials: 10,
      _my_quantity: 3,
      _note: null,
      _expires_at: null,
      _shop_area: "group_buy_1",
    });
    expect(rpc).not.toHaveBeenCalledWith("sync_completed_kit_request_carts", expect.anything());
    expect(card.status).toBe("open");
  });

  it("syncs carts only through sync_completed_kit_request_carts", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        kitRequestId: "req-1",
        myQuantity: 0,
        remainingQuantity: 0,
        status: "full",
        myPriceUsd: 36,
        cartSynced: true,
      },
      error: null,
    });
    const result = await syncCompletedKitRequestCarts("req-1");
    expect(rpc).toHaveBeenCalledWith("sync_completed_kit_request_carts", { _kit_share_id: "req-1" });
    expect(result.cartSynced).toBe(true);
  });

  it("keeps join preview limited to the caller's price", async () => {
    rpc.mockResolvedValue({
      data: {
        kitRequestId: "req-1",
        myQuantity: 2,
        remainingQuantity: 6,
        remainingAfterJoin: 4,
        status: "open",
        myPriceUsd: 36,
        myUnitPriceUsd: 18,
      },
      error: null,
    });
    const preview = await previewKitRequestJoin("req-1", 2);
    expect(preview.myPriceUsd).toBe(36);
    expect(JSON.stringify(preview)).not.toMatch(/email|markup|display_name/i);
  });
});

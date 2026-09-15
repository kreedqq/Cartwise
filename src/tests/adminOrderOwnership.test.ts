import { describe, expect, it, vi } from "vitest";

import { adminTransferOrders } from "@/services/adminOrderOwnership";
import { supabase } from "@/lib/supabaseClient";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

describe("adminTransferOrders", () => {
  it("calls admin_transfer_orders RPC with all order ids atomically", async () => {
    const rpc = vi.mocked(supabase.rpc);
    rpc.mockResolvedValue({
      data: {
        fromUserId: "a",
        toUserId: "b",
        orderIds: ["o1", "o2"],
        orderNumbers: ["CW-1", "CW-2"],
        count: 2,
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.rpc>>);

    const result = await adminTransferOrders({
      fromUserId: "a",
      toUserId: "b",
      orderIds: ["o1", "o2"],
      reason: "Account merge",
    });

    expect(rpc).toHaveBeenCalledWith("admin_transfer_orders", {
      _from_user_id: "a",
      _to_user_id: "b",
      _order_ids: ["o1", "o2"],
      _reason: "Account merge",
    });
    expect(result.count).toBe(2);
  });
});

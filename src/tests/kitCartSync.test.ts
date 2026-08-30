import { describe, expect, it } from "vitest";

import {
  canOrderKitShare,
  KIT_OVERFLOW_MESSAGE,
  totalAllocatedVials,
  validateKitAllocation,
} from "@/lib/shop/kitShare";

/**
 * Server-side cart sync is enforced in migration 0034 via kit_share_sync_participant_cart.
 * These tests cover allocation rules that the RPC relies on before writing cart lines.
 */
describe("kit cart sync allocation prerequisites", () => {
  it("allows 3 + 7 allocation for a 10-vial kit", () => {
    const participants = [{ quantity: 3 }, { quantity: 7 }];
    expect(validateKitAllocation(10, participants).ok).toBe(true);
    expect(totalAllocatedVials(participants)).toBe(10);
    expect(canOrderKitShare(10, participants)).toBe(true);
  });

  it("allows 4 + 6 allocation", () => {
    const participants = [{ quantity: 4 }, { quantity: 6 }];
    expect(validateKitAllocation(10, participants).ok).toBe(true);
    expect(canOrderKitShare(10, participants)).toBe(true);
  });

  it("allows 2 + 3 + 5 allocation across three participants", () => {
    const participants = [{ quantity: 2 }, { quantity: 3 }, { quantity: 5 }];
    expect(validateKitAllocation(10, participants).ok).toBe(true);
    expect(canOrderKitShare(10, participants)).toBe(true);
  });

  it("blocks 6 + 5 overflow", () => {
    const result = validateKitAllocation(10, [{ quantity: 6 }, { quantity: 5 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(KIT_OVERFLOW_MESSAGE);
    }
  });

  it("keeps kit open when allocation is incomplete", () => {
    expect(canOrderKitShare(10, [{ quantity: 5 }, { quantity: 4 }])).toBe(false);
  });
});

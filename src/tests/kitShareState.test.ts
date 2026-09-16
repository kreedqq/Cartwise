import { describe, expect, it } from "vitest";

import { KIT_ALMOST_FULL_REMAINING_THRESHOLD, projectKitShareState } from "@/lib/kit/kitShareState";

describe("projectKitShareState", () => {
  it("marks almost full when open and remaining at threshold", () => {
    const state = projectKitShareState({
      status: "open",
      allocatedQuantity: 8,
      kitSize: 10,
      isOpenRequest: true,
    });
    expect(KIT_ALMOST_FULL_REMAINING_THRESHOLD).toBe(2);
    expect(state.remainingQuantity).toBe(2);
    expect(state.isAlmostFull).toBe(true);
    expect(state.displayStatusLabel).toBe("Fast voll");
    expect(state.isJoinable).toBe(true);
  });

  it("full kit is not joinable", () => {
    const state = projectKitShareState({
      status: "full",
      allocatedQuantity: 10,
      kitSize: 10,
      isOpenRequest: true,
    });
    expect(state.isFull).toBe(true);
    expect(state.isJoinable).toBe(false);
  });

  it("ordered kit is locked and not editable", () => {
    const state = projectKitShareState({
      status: "ordered",
      allocatedQuantity: 10,
      kitSize: 10,
      isOpenRequest: true,
      isLocked: true,
    });
    expect(state.isOrdered).toBe(true);
    expect(state.isLocked).toBe(true);
    expect(state.isEditable).toBe(false);
  });
});

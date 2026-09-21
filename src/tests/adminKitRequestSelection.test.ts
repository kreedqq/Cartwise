import { describe, expect, it } from "vitest";

import {
  areAllKitRequestsOnPageSelected,
  areSomeKitRequestsOnPageSelected,
  kitRequestSelectionCount,
  kitRequestSelectionIds,
  toggleAllKitRequestsOnPage,
  toggleKitRequestInSelection,
} from "@/lib/adminKitRequestSelection";

const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";
const ID_C = "33333333-3333-3333-3333-333333333333";

describe("adminKitRequestSelection", () => {
  it("selects A, then B, keeping both in the set", () => {
    let selected = toggleKitRequestInSelection(new Set(), ID_A, true);
    expect(kitRequestSelectionIds(selected).sort()).toEqual([ID_A]);
    selected = toggleKitRequestInSelection(selected, ID_B, true);
    expect(kitRequestSelectionIds(selected).sort()).toEqual([ID_A, ID_B].sort());
    expect(kitRequestSelectionCount(selected)).toBe(2);
  });

  it("select all on page adds every visible id without dropping prior off-page ids", () => {
    const offPage = "44444444-4444-4444-4444-444444444444";
    const base = new Set([offPage]);
    const selected = toggleAllKitRequestsOnPage(base, [ID_A, ID_B], true);
    expect(kitRequestSelectionCount(selected)).toBe(3);
    expect(selected.has(ID_A)).toBe(true);
    expect(selected.has(ID_B)).toBe(true);
    expect(selected.has(offPage)).toBe(true);
  });

  it("deselect all on page removes only visible ids", () => {
    const selected = toggleAllKitRequestsOnPage(new Set([ID_A, ID_B, ID_C]), [ID_A, ID_B], false);
    expect(kitRequestSelectionIds(selected)).toEqual([ID_C]);
  });

  it("reports header checkbox state for partial and full page selection", () => {
    const partial = toggleKitRequestInSelection(new Set(), ID_A, true);
    expect(areSomeKitRequestsOnPageSelected(partial, [ID_A, ID_B])).toBe(true);
    expect(areAllKitRequestsOnPageSelected(partial, [ID_A, ID_B])).toBe(false);

    const all = toggleAllKitRequestsOnPage(new Set(), [ID_A, ID_B], true);
    expect(areAllKitRequestsOnPageSelected(all, [ID_A, ID_B])).toBe(true);
  });

  it("exposes stable id list for bulk RPC payloads", () => {
    const selected = toggleAllKitRequestsOnPage(new Set(), [ID_A, ID_B], true);
    expect(new Set(kitRequestSelectionIds(selected))).toEqual(selected);
  });
});

import { describe, expect, it } from "vitest";

import {
  adminKitBulkActionHint,
  adminKitListItemsAfterBulkCancel,
  adminKitPartitionBulkTargets,
  adminKitSelectionAfterBulkDelete,
  adminKitSelectionCanBulkCancel,
  adminKitSelectionCanBulkDelete,
} from "@/lib/adminKitRequestBulk";
import {
  kitRequestSelectionCount,
  toggleAllKitRequestsOnPage,
} from "@/lib/adminKitRequestSelection";
import type { AdminKitRequestListItem } from "@/services/adminKitRequests";

function item(partial: Partial<AdminKitRequestListItem>): AdminKitRequestListItem {
  return {
    id: partial.id ?? "id",
    productId: null,
    productName: partial.productName ?? "Test",
    productCode: null,
    variantLabel: "",
    category: "",
    kitSizeVials: 10,
    allocatedTotal: 5,
    remainingVials: 5,
    status: partial.status ?? "open",
    creatorUsername: "user",
    participantCount: 1,
    createdAt: "",
    updatedAt: "",
    expiresAt: null,
    completedAt: null,
    note: null,
    shopArea: "group_buy_1",
    vendorCode: null,
    areaProductId: null,
    masterProductId: null,
    orderSyncLabel: null,
    orderSyncSyncedCount: 0,
    orderSyncParticipantCount: 0,
    canCancel: partial.canCancel ?? false,
    canDelete: partial.canDelete ?? false,
  };
}

describe("adminKitPartitionBulkTargets", () => {
  it("splits 2 open + 2 cancelled into cancelable and deletable ids", () => {
    const items = [
      item({ id: "a", canCancel: true, status: "open" }),
      item({ id: "b", canCancel: true, status: "open" }),
      item({ id: "c", canDelete: true, status: "cancelled" }),
      item({ id: "d", canDelete: true, status: "cancelled" }),
    ];
    const selected = new Set(["a", "b", "c", "d"]);
    expect(adminKitPartitionBulkTargets(selected, items)).toEqual({
      cancelableIds: ["a", "b"],
      deletableIds: ["c", "d"],
    });
  });

  it("returns 3 deletable ids for 3 cancelled rows", () => {
    const items = [
      item({ id: "a", canDelete: true, status: "cancelled" }),
      item({ id: "b", canDelete: true, status: "cancelled" }),
      item({ id: "c", canDelete: true, status: "cancelled" }),
    ];
    const selected = new Set(["a", "b", "c"]);
    const { cancelableIds, deletableIds } = adminKitPartitionBulkTargets(selected, items);
    expect(cancelableIds).toEqual([]);
    expect(deletableIds).toEqual(["a", "b", "c"]);
  });

  it("returns 3 cancelable ids for 3 open rows", () => {
    const items = [
      item({ id: "a", canCancel: true, status: "open" }),
      item({ id: "b", canCancel: true, status: "open" }),
      item({ id: "c", canCancel: true, status: "open" }),
    ];
    const selected = new Set(["a", "b", "c"]);
    const { cancelableIds, deletableIds } = adminKitPartitionBulkTargets(selected, items);
    expect(cancelableIds).toEqual(["a", "b", "c"]);
    expect(deletableIds).toEqual([]);
  });

  it("splits 2 ordered + 1 cancelled", () => {
    const items = [
      item({ id: "a", canCancel: true, status: "ordered" }),
      item({ id: "b", canCancel: true, status: "ordered" }),
      item({ id: "c", canDelete: true, status: "cancelled" }),
    ];
    const selected = new Set(["a", "b", "c"]);
    expect(adminKitPartitionBulkTargets(selected, items)).toEqual({
      cancelableIds: ["a", "b"],
      deletableIds: ["c"],
    });
  });

  it("never includes non-cancelable ids in cancelableIds", () => {
    const items = [
      item({ id: "a", canCancel: true, status: "open" }),
      item({ id: "b", canCancel: false, canDelete: true, status: "cancelled" }),
    ];
    const selected = new Set(["a", "b"]);
    const { cancelableIds, deletableIds } = adminKitPartitionBulkTargets(selected, items);
    expect(cancelableIds).toEqual(["a"]);
    expect(deletableIds).toEqual(["b"]);
    expect(cancelableIds).not.toContain("b");
    expect(deletableIds).not.toContain("a");
  });

  it("omits ids that are selected but not on the current list page", () => {
    const items = [item({ id: "a", canCancel: true, status: "open" })];
    const selected = new Set(["a", "off-page"]);
    expect(adminKitPartitionBulkTargets(selected, items)).toEqual({
      cancelableIds: ["a"],
      deletableIds: [],
    });
  });
});

describe("adminKitRequestBulk after cancel reload", () => {
  it("keeps the same selected id set after bulk cancel (no clear)", () => {
    const selected = new Set(["a", "b", "c"]);
    expect(kitRequestSelectionCount(selected)).toBe(3);
    const afterCancel = new Set(selected);
    expect(afterCancel).toEqual(selected);
  });

  it("after cancel reload, all 30 rows become deletable when 20 open were cancelled", () => {
    const openIds = Array.from({ length: 20 }, (_, i) => `open-${i}`);
    const cancelledIds = Array.from({ length: 10 }, (_, i) => `can-${i}`);
    const before = [
      ...openIds.map((id) => item({ id, canCancel: true, status: "open" })),
      ...cancelledIds.map((id) => item({ id, canDelete: true, status: "cancelled" })),
    ];
    const selected = new Set([...openIds, ...cancelledIds]);
    const { cancelableIds } = adminKitPartitionBulkTargets(selected, before);
    expect(cancelableIds).toHaveLength(20);

    const afterList = adminKitListItemsAfterBulkCancel(before, openIds);
    const { cancelableIds: cancelAfter, deletableIds: deleteAfter } = adminKitPartitionBulkTargets(
      selected,
      afterList,
    );
    expect(cancelAfter).toEqual([]);
    expect(deleteAfter).toHaveLength(30);
  });
});

describe("adminKitRequestBulk selection rules", () => {
  it("allows bulk cancel only when every selected row is cancellable", () => {
    expect(
      adminKitSelectionCanBulkCancel([
        item({ canCancel: true, status: "open" }),
        item({ id: "2", canCancel: true, status: "open" }),
      ]),
    ).toBe(true);
    expect(
      adminKitSelectionCanBulkCancel([
        item({ canCancel: true }),
        item({ id: "2", canCancel: false, status: "cancelled" }),
      ]),
    ).toBe(false);
  });

  it("allows bulk delete only when every selected row is deletable", () => {
    expect(adminKitSelectionCanBulkDelete([item({ canDelete: true, status: "cancelled" })])).toBe(
      true,
    );
    expect(
      adminKitSelectionCanBulkDelete([
        item({ canDelete: true }),
        item({ id: "2", canDelete: false, status: "ordered" }),
      ]),
    ).toBe(false);
  });

  it("allows bulk cancel for ordered kits when list flags permit", () => {
    expect(
      adminKitSelectionCanBulkCancel([item({ canCancel: true, status: "ordered" })]),
    ).toBe(true);
  });

  it("shows no blocking hint when mixed cancel and delete are available", () => {
    const items = [
      item({ id: "a", canCancel: true, status: "open" }),
      item({ id: "b", canDelete: true, status: "cancelled" }),
    ];
    expect(adminKitBulkActionHint(2, 1, 1, items)).toBeNull();
  });

  it("explains blocked all-cancelled selections", () => {
    expect(
      adminKitBulkActionHint(1, 0, 0, [
        item({ canCancel: false, canDelete: false, status: "cancelled" }),
      ]),
    ).toContain("serverseitig");
  });
});

describe("adminKitRequestBulk select all", () => {
  it("select all keeps count correct and partition matches visible flags", () => {
    const items = [
      item({ id: "a", canCancel: true }),
      item({ id: "b", canCancel: true }),
      item({ id: "c", canDelete: true, status: "cancelled" }),
    ];
    const selected = toggleAllKitRequestsOnPage(
      new Set(),
      items.map((i) => i.id),
      true,
    );
    expect(kitRequestSelectionCount(selected)).toBe(3);
    const { cancelableIds, deletableIds } = adminKitPartitionBulkTargets(selected, items);
    expect(cancelableIds).toEqual(["a", "b"]);
    expect(deletableIds).toEqual(["c"]);
  });
});

describe("adminKitSelectionAfterBulkDelete", () => {
  it("removes only deleted ids from selection", () => {
    const selected = new Set(["a", "b", "c"]);
    expect(adminKitSelectionAfterBulkDelete(selected, ["b", "c"])).toEqual(new Set(["a"]));
  });
});

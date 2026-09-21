import { describe, expect, it } from "vitest";

import {
  adminKitBulkActionHint,
  adminKitSelectionCanBulkCancel,
  adminKitSelectionCanBulkDelete,
} from "@/lib/adminKitRequestBulk";
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

  it("explains blocked mixed selections", () => {
    expect(
      adminKitBulkActionHint([
        item({ canCancel: false, canDelete: false, status: "ordered" }),
      ]),
    ).toContain("Bestellte");
    expect(
      adminKitBulkActionHint([
        item({ canCancel: false, canDelete: false, status: "full" }),
      ]),
    ).toContain("keine gemeinsame");
  });
});

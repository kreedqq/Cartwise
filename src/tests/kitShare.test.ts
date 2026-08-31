import { describe, expect, it } from "vitest";

import {
  addKitParticipant,
  canOrderKitShare,
  createKitShareDraft,
  KIT_OVERFLOW_MESSAGE,
  participantBaseShareUsd,
  participantRoleShareUsd,
  remainingKitUnits,
  sanitizeKitShareForViewer,
  totalAllocatedUnits,
  updateKitDistribution,
  updateParticipantQuantity,
  validateFullKitDistribution,
  validateKitAllocation,
} from "@/lib/shop/kitShare";

const baseDraft = createKitShareDraft({
  product: { id: "p1", code: "10AD", name: "AOD9604" },
  kitSizeUnits: 10,
  creatorUserId: "user-a",
  creatorDisplayName: "Test User",
  creatorQuantity: 3,
})!;

describe("kit allocation validation", () => {
  it("blocks overflow beyond kit size", () => {
    const result = validateKitAllocation(10, [{ quantity: 6 }, { quantity: 5 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.total).toBe(11);
      expect(result.message).toBe(KIT_OVERFLOW_MESSAGE);
    }
  });

  it("allows full kit allocation", () => {
    expect(validateKitAllocation(10, [{ quantity: 3 }, { quantity: 7 }]).ok).toBe(true);
    expect(canOrderKitShare(10, [{ quantity: 3 }, { quantity: 7 }])).toBe(true);
  });

  it("tracks remaining units", () => {
    expect(remainingKitUnits(10, [{ quantity: 3 }, { quantity: 4 }])).toBe(3);
    expect(totalAllocatedUnits([{ quantity: 3 }, { quantity: 4 }])).toBe(7);
  });

  it("blocks order until kit is fully allocated", () => {
    expect(canOrderKitShare(10, [{ quantity: 3 }, { quantity: 4 }])).toBe(false);
  });
});

describe("multi-participant kit sharing", () => {
  it("supports more than two participants", () => {
    let draft = baseDraft;
    const b = addKitParticipant(draft, { userId: "user-b", displayName: "Example User", quantity: 3 });
    expect(b.ok).toBe(true);
    draft = b.ok ? b.draft : draft;
    const c = addKitParticipant(draft, { userId: "user-c", displayName: "Alex", quantity: 4 });
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(totalAllocatedUnits(c.draft.participants)).toBe(10);
      expect(canOrderKitShare(10, c.draft.participants)).toBe(true);
    }
  });

  it("prevents duplicate participants", () => {
    const withB = addKitParticipant(baseDraft, { userId: "user-b", displayName: "Example User", quantity: 4 });
    if (!withB.ok) throw new Error("setup failed");
    const dup = addKitParticipant(withB.draft, { userId: "user-b", displayName: "Example User", quantity: 2 });
    expect(dup.ok).toBe(false);
  });
});

describe("kit price split", () => {
  it("splits kit total evenly by vial count at base price", () => {
    expect(participantBaseShareUsd(300, 10, 3)).toBe(90);
    expect(participantBaseShareUsd(300, 10, 7)).toBe(210);
  });

  it("applies role markup only to the requesting participant share", () => {
    expect(participantRoleShareUsd(300, 10, 3, 0)).toBe(90);
    expect(participantRoleShareUsd(300, 10, 7, 25)).toBe(262.5);
  });
});

describe("price privacy sanitizer", () => {
  it("does not expose foreign prices in viewer payload", () => {
    let draft = baseDraft;
    const added = addKitParticipant(draft, { userId: "user-b", displayName: "Example User", quantity: 7 });
    if (!added.ok) throw new Error("setup failed");
    draft = added.draft;

    const viewA = sanitizeKitShareForViewer(draft, "user-a");
    const viewB = sanitizeKitShareForViewer(draft, "user-b");

    expect(viewA.myQuantity).toBe(3);
    expect(viewB.myQuantity).toBe(7);
    expect(JSON.stringify(viewA)).not.toContain("262");
    expect(JSON.stringify(viewB)).not.toContain("90");
    expect(Object.keys(viewA)).not.toContain("participants");
  });
});

describe("participant quantity edits", () => {
  it("allows creator to change own quantity within kit size", () => {
    const updated = updateParticipantQuantity(baseDraft, "user-a", 4, "user-a");
    expect(updated.ok).toBe(true);
  });

  it("blocks non-participants from editing foreign quantities", () => {
    const withB = addKitParticipant(baseDraft, { userId: "user-b", displayName: "Example User", quantity: 4 });
    if (!withB.ok) throw new Error("setup failed");
    const blocked = updateParticipantQuantity(withB.draft, "user-b", 5, "user-c");
    expect(blocked.ok).toBe(false);
  });
});

describe("ten-unit rule", () => {
  const passCases = [
    [{ quantity: 3 }, { quantity: 7 }],
    [{ quantity: 4 }, { quantity: 6 }],
    [{ quantity: 2 }, { quantity: 3 }, { quantity: 5 }],
    [{ quantity: 1 }, { quantity: 1 }, { quantity: 8 }],
    [{ quantity: 5 }, { quantity: 5 }],
    [{ quantity: 3 }, { quantity: 7 }, { quantity: 10 }],
    [{ quantity: 5 }, { quantity: 5 }, { quantity: 5 }, { quantity: 5 }],
  ] as const;

  it.each(passCases.map((p, i) => [i, p] as const))("allows valid full allocation %i", (_i, participants) => {
    const total = totalAllocatedUnits(participants);
    const kitSize = total;
    expect(validateFullKitDistribution(kitSize, participants).ok).toBe(true);
  });

  const failCases = [
    [{ quantity: 6 }, { quantity: 5 }],
    [{ quantity: 3 }, { quantity: 3 }, { quantity: 5 }],
    [{ quantity: 5 }, { quantity: 5 }, { quantity: 5 }],
    [{ quantity: 9 }, { quantity: 9 }],
  ] as const;

  it.each(failCases.map((p, i) => [i, p] as const))("blocks invalid totals %i", (_i, participants) => {
    const total = totalAllocatedUnits(participants);
    expect(validateFullKitDistribution(total, participants).ok).toBe(false);
  });

  it("rejects invalid kit sizes 11, 15, 21, 25", () => {
    expect(createKitShareDraft({
      product: { id: "p1", code: "10AD", name: "AOD9604" },
      kitSizeUnits: 11,
      creatorUserId: "user-a",
      creatorDisplayName: "Test User",
      creatorQuantity: 5,
    })).toBeNull();
    expect(createKitShareDraft({
      product: { id: "p1", code: "10AD", name: "AOD9604" },
      kitSizeUnits: 15,
      creatorUserId: "user-a",
      creatorDisplayName: "Test User",
      creatorQuantity: 5,
    })).toBeNull();
    expect(createKitShareDraft({
      product: { id: "p1", code: "10AD", name: "AOD9604" },
      kitSizeUnits: 21,
      creatorUserId: "user-a",
      creatorDisplayName: "Test User",
      creatorQuantity: 10,
    })).toBeNull();
    expect(createKitShareDraft({
      product: { id: "p1", code: "10AD", name: "AOD9604" },
      kitSizeUnits: 25,
      creatorUserId: "user-a",
      creatorDisplayName: "Test User",
      creatorQuantity: 10,
    })).toBeNull();
  });
});

describe("distribution updates", () => {
  function fullDraft() {
    const withB = addKitParticipant(baseDraft, { userId: "user-b", displayName: "Example User", quantity: 7 });
    if (!withB.ok) throw new Error("setup failed");
    return withB.draft;
  }

  it("allows creator to rebalance 3+7 to 4+6", () => {
    const draft = fullDraft();
    const result = updateKitDistribution(
      draft,
      [
        { userId: "user-a", quantity: 4 },
        { userId: "user-b", quantity: 6 },
      ],
      "user-a",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(totalAllocatedUnits(result.draft.participants)).toBe(10);
    }
  });

  it("blocks invalid rebalance 4+7", () => {
    const draft = fullDraft();
    const result = updateKitDistribution(
      draft,
      [
        { userId: "user-a", quantity: 4 },
        { userId: "user-b", quantity: 7 },
      ],
      "user-a",
    );
    expect(result.ok).toBe(false);
  });

  it("blocks non-creator from editing distribution", () => {
    const draft = fullDraft();
    const result = updateKitDistribution(
      draft,
      [
        { userId: "user-a", quantity: 5 },
        { userId: "user-b", quantity: 5 },
      ],
      "user-b",
    );
    expect(result.ok).toBe(false);
  });
});

describe("twenty-unit kits", () => {
  it("allows 3+7+4+6 across four participants", () => {
    expect(
      validateFullKitDistribution(20, [
        { quantity: 3 },
        { quantity: 7 },
        { quantity: 4 },
        { quantity: 6 },
      ]).ok,
    ).toBe(true);
  });

  it("allows 6+14 for size-20 kit", () => {
    expect(validateFullKitDistribution(20, [{ quantity: 6 }, { quantity: 14 }]).ok).toBe(true);
  });

  it("allows 10+10 for size-20 kit", () => {
    expect(validateFullKitDistribution(20, [{ quantity: 10 }, { quantity: 10 }]).ok).toBe(true);
  });

  it("allows 7+13 for size-20 kit", () => {
    expect(validateFullKitDistribution(20, [{ quantity: 7 }, { quantity: 13 }]).ok).toBe(true);
  });

  it("blocks 21 total for size-20 kit", () => {
    expect(
      validateKitAllocation(20, [
        { quantity: 3 },
        { quantity: 7 },
        { quantity: 5 },
        { quantity: 5 },
        { quantity: 1 },
      ]).ok,
    ).toBe(false);
  });
});

describe("thirty-unit kits", () => {
  it("allows 15+15 for size-30 kit", () => {
    expect(validateFullKitDistribution(30, [{ quantity: 15 }, { quantity: 15 }]).ok).toBe(true);
  });

  it("allows 20+10 for size-30 kit", () => {
    expect(validateFullKitDistribution(30, [{ quantity: 20 }, { quantity: 10 }]).ok).toBe(true);
  });

  it("allows 10+20 for size-30 kit", () => {
    expect(validateFullKitDistribution(30, [{ quantity: 10 }, { quantity: 20 }]).ok).toBe(true);
  });
});

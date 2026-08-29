import { describe, expect, it } from "vitest";

import {
  addKitParticipant,
  canOrderKitShare,
  createKitShareDraft,
  KIT_OVERFLOW_MESSAGE,
  participantBaseShareUsd,
  participantRoleShareUsd,
  remainingKitVials,
  sanitizeKitShareForViewer,
  totalAllocatedVials,
  updateParticipantQuantity,
  validateKitAllocation,
} from "@/lib/shop/kitShare";

const baseDraft = createKitShareDraft({
  product: { id: "p1", code: "10AD", name: "AOD9604" },
  creatorUserId: "user-a",
  creatorDisplayName: "Erkan",
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

  it("tracks remaining vials", () => {
    expect(remainingKitVials(10, [{ quantity: 3 }, { quantity: 4 }])).toBe(3);
    expect(totalAllocatedVials([{ quantity: 3 }, { quantity: 4 }])).toBe(7);
  });

  it("blocks order until kit is fully allocated", () => {
    expect(canOrderKitShare(10, [{ quantity: 3 }, { quantity: 4 }])).toBe(false);
  });
});

describe("multi-participant kit sharing", () => {
  it("supports more than two participants", () => {
    let draft = baseDraft;
    const b = addKitParticipant(draft, { userId: "user-b", displayName: "Max", quantity: 3 });
    expect(b.ok).toBe(true);
    draft = b.ok ? b.draft : draft;
    const c = addKitParticipant(draft, { userId: "user-c", displayName: "Alex", quantity: 4 });
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(totalAllocatedVials(c.draft.participants)).toBe(10);
      expect(canOrderKitShare(10, c.draft.participants)).toBe(true);
    }
  });

  it("prevents duplicate participants", () => {
    const withB = addKitParticipant(baseDraft, { userId: "user-b", displayName: "Max", quantity: 4 });
    if (!withB.ok) throw new Error("setup failed");
    const dup = addKitParticipant(withB.draft, { userId: "user-b", displayName: "Max", quantity: 2 });
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
    const added = addKitParticipant(draft, { userId: "user-b", displayName: "Max", quantity: 7 });
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
    const withB = addKitParticipant(baseDraft, { userId: "user-b", displayName: "Max", quantity: 4 });
    if (!withB.ok) throw new Error("setup failed");
    const blocked = updateParticipantQuantity(withB.draft, "user-b", 5, "user-c");
    expect(blocked.ok).toBe(false);
  });
});

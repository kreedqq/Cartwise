import { describe, expect, it } from "vitest";

import { kitRequestActionLabel, kitRequestPrimaryAction } from "@/lib/kit/kitRequestActions";
import type { KitRequestCard } from "@/services/kitRequests";

function card(partial: Partial<KitRequestCard>): KitRequestCard {
  return {
    id: "k1",
    productId: "p1",
    productName: "KP10",
    productCode: "KP10",
    variantLabel: "10mg",
    category: "peptides",
    creatorUsername: "alice",
    kitSizeVials: 10,
    allocatedTotal: 6,
    remainingVials: 4,
    creatorQuantity: 2,
    myQuantity: 0,
    myUnitPriceUsd: 6,
    myPriceUsd: null,
    isCreator: false,
    isParticipant: false,
    status: "open",
    createdAt: "",
    expiresAt: null,
    completedAt: null,
    note: null,
    ...partial,
  };
}

describe("kitRequestPrimaryAction", () => {
  it("offers join when open and slots remain", () => {
    expect(kitRequestPrimaryAction(card({}))).toBe("join");
    expect(kitRequestActionLabel("join")).toBe("Mitmachen");
  });

  it("shows full when no slots and not participant", () => {
    expect(kitRequestPrimaryAction(card({ status: "full", remainingVials: 0 }))).toBe("full");
  });
});

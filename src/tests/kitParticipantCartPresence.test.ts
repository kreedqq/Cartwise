import { describe, expect, it } from "vitest";

import {
  canAdminSyncNotInCartKitLine,
  canRestoreRemovedKitCartLine,
  participantCartPresenceLabel,
  participantHasKitCartLine,
  resolveParticipantCartPresence,
} from "@/lib/kitParticipantCartPresence";

const baseParticipant = {
  kit_share_id: "kit-1",
  user_id: "user-a",
  quantity: 7,
  order_id: null as string | null,
};

describe("kit participant cart presence", () => {
  it("returns ordered when order_id or ordered_at is set", () => {
    expect(
      resolveParticipantCartPresence(
        { ...baseParticipant, order_id: "order-1" },
        [],
      ),
    ).toBe("ordered");
    expect(
      resolveParticipantCartPresence(
        { ...baseParticipant, ordered_at: new Date().toISOString() },
        [],
      ),
    ).toBe("ordered");
  });

  it("returns in_cart when a kit cart line exists for the participant", () => {
    const links = [
      {
        cart_id: "cart-1",
        kit_share_id: "kit-1",
        product_id: "prod-1",
        quantity: 7,
        user_id: "user-a",
      },
    ];
    expect(resolveParticipantCartPresence(baseParticipant, links)).toBe("in_cart");
    expect(participantHasKitCartLine(baseParticipant, links)).toBe(true);
  });

  it("distinguishes removed_from_cart from not_in_cart via cart_line_removed_at", () => {
    expect(resolveParticipantCartPresence(baseParticipant, [])).toBe("not_in_cart");
    expect(
      resolveParticipantCartPresence(
        { ...baseParticipant, cart_line_removed_at: "2026-01-01T00:00:00.000Z" },
        [],
      ),
    ).toBe("removed_from_cart");
    expect(participantCartPresenceLabel("removed_from_cart")).toBe("Kit-Anteil entfernt");
    expect(participantCartPresenceLabel("not_in_cart")).toBe("Noch nicht im Warenkorb");
  });

  it("prefers removed_from_cart over in_cart when removal timestamp is set", () => {
    const links = [
      {
        cart_id: "cart-1",
        kit_share_id: "kit-1",
        product_id: "prod-1",
        quantity: 7,
        user_id: "user-a",
      },
    ];
    expect(
      resolveParticipantCartPresence(
        { ...baseParticipant, cart_line_removed_at: "2026-01-01T00:00:00.000Z" },
        links,
      ),
    ).toBe("removed_from_cart");
  });

  it("allows restore only for removed, not-yet-ordered participants", () => {
    const removed = {
      ...baseParticipant,
      cart_line_removed_at: "2026-01-01T00:00:00.000Z",
    };
    expect(canRestoreRemovedKitCartLine(removed, [])).toBe(true);
    expect(canRestoreRemovedKitCartLine({ ...removed, order_id: "order-1" }, [])).toBe(false);
    expect(canRestoreRemovedKitCartLine(baseParticipant, [])).toBe(false);
  });

  it("allows admin sync only for not_in_cart on active kits", () => {
    expect(canAdminSyncNotInCartKitLine(baseParticipant, [], "full")).toBe(true);
    expect(canAdminSyncNotInCartKitLine(baseParticipant, [], "open")).toBe(true);
    expect(canAdminSyncNotInCartKitLine(baseParticipant, [], "cancelled")).toBe(false);
    expect(canAdminSyncNotInCartKitLine(baseParticipant, [], "ordered")).toBe(false);
    expect(
      canAdminSyncNotInCartKitLine(
        { ...baseParticipant, cart_line_removed_at: "2026-01-01T00:00:00.000Z" },
        [],
        "full",
      ),
    ).toBe(false);
    expect(canAdminSyncNotInCartKitLine({ ...baseParticipant, order_id: "o1" }, [], "full")).toBe(false);
  });
});

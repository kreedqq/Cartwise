import type { KitShareCartLink, KitShareContextParticipant } from "@/lib/kitOrderSummary";

/** Internal cart-participant states (UI uses German labels via labels). */
export type ParticipantCartPresenceState =
  | "ordered"
  | "in_cart"
  | "removed_from_cart"
  | "not_in_cart";

export const PARTICIPANT_CART_PRESENCE_LABELS: Record<ParticipantCartPresenceState, string> = {
  ordered: "Bestellung eingegangen",
  in_cart: "Im Warenkorb",
  removed_from_cart: "Kit-Anteil entfernt",
  not_in_cart: "Noch nicht im Warenkorb",
};

export type KitParticipantCartFields = Pick<
  KitShareContextParticipant,
  "kit_share_id" | "user_id" | "quantity" | "order_id"
> & {
  ordered_at?: string | null;
  cart_line_removed_at?: string | null;
  cart_line_last_in_cart_at?: string | null;
};

export type CartLinkWithUser = KitShareCartLink & { user_id: string };

export function participantHasKitCartLine(
  participant: Pick<KitShareContextParticipant, "kit_share_id" | "user_id">,
  cartLinks: CartLinkWithUser[],
): boolean {
  return cartLinks.some(
    (link) => link.kit_share_id === participant.kit_share_id && link.user_id === participant.user_id,
  );
}

/** Central participant cart presence (admin context). Priority: ordered → removed → in_cart → not_in_cart. */
export function resolveParticipantCartPresence(
  participant: KitParticipantCartFields,
  cartLinks: CartLinkWithUser[],
): ParticipantCartPresenceState {
  return getKitParticipantCartPresence(participant, cartLinks);
}

export function getKitParticipantCartPresence(
  participant: KitParticipantCartFields,
  cartLinks: CartLinkWithUser[],
): ParticipantCartPresenceState {
  if (participant.order_id || participant.ordered_at) {
    return "ordered";
  }
  if (participant.cart_line_removed_at) {
    return "removed_from_cart";
  }
  if (participantHasKitCartLine(participant, cartLinks)) {
    return "in_cart";
  }
  return "not_in_cart";
}

export function mapServerKitCartPresence(value: unknown): ParticipantCartPresenceState | null {
  if (value === "ordered" || value === "in_cart" || value === "removed_from_cart" || value === "not_in_cart") {
    return value;
  }
  return null;
}

export function participantCartPresenceLabel(state: ParticipantCartPresenceState): string {
  return PARTICIPANT_CART_PRESENCE_LABELS[state];
}

export function canRestoreRemovedKitCartLine(
  participant: KitParticipantCartFields,
  cartLinks: CartLinkWithUser[],
): boolean {
  return resolveParticipantCartPresence(participant, cartLinks) === "removed_from_cart";
}

/** Admin-only manual sync when participant never had a tracked cart line (not_in_cart). */
export function canAdminSyncNotInCartKitLine(
  participant: KitParticipantCartFields,
  cartLinks: CartLinkWithUser[],
  kitStatus?: string | null,
): boolean {
  if (kitStatus === "cancelled" || kitStatus === "ordered") return false;
  return resolveParticipantCartPresence(participant, cartLinks) === "not_in_cart";
}

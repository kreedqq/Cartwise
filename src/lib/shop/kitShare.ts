import { applyRoleMarkup, roundCurrency } from "@/lib/money";
import { isValidKitSize, KIT_SIZE_MIN, KIT_SIZE_STEP } from "@/lib/shop/kitUnits";

export const KIT_SHARE_STATUSES = [
  "OPEN",
  "PARTIALLY_ALLOCATED",
  "FULLY_ALLOCATED",
  "ORDERED",
  "CANCELLED",
] as const;

export type KitShareStatus = (typeof KIT_SHARE_STATUSES)[number];

export interface KitShareParticipant {
  userId: string;
  displayName: string;
  quantity: number;
}

export interface KitShareDraft {
  productId: string;
  productCode: string;
  productName: string;
  kitSizeUnits: number;
  creatorUserId: string;
  participants: KitShareParticipant[];
  status: KitShareStatus;
}

export const KIT_OVERFLOW_MESSAGE = "Die gewünschte Menge überschreitet die verfügbare Kitmenge.";
export const KIT_INVALID_TOTAL_MESSAGE = "Die Gesamtmenge muss durch 10 teilbar sein.";
export const KIT_INVALID_DISTRIBUTION_MESSAGE = "Ungültige Kit Verteilung.";
export const KIT_INCOMPLETE_DISTRIBUTION_MESSAGE =
  "Die Verteilung muss exakt der Kitgröße entsprechen.";

export function kitShareStatus(totalAllocated: number, kitSize: number): KitShareStatus {
  if (totalAllocated <= 0) return "OPEN";
  if (totalAllocated >= kitSize) return "FULLY_ALLOCATED";
  return "PARTIALLY_ALLOCATED";
}

export function totalAllocatedUnits(participants: readonly Pick<KitShareParticipant, "quantity">[]): number {
  return participants.reduce((sum, p) => sum + p.quantity, 0);
}

/** @deprecated use totalAllocatedUnits */
export const totalAllocatedVials = totalAllocatedUnits;

export function remainingKitUnits(
  kitSize: number,
  participants: readonly Pick<KitShareParticipant, "quantity">[],
): number {
  return Math.max(0, kitSize - totalAllocatedUnits(participants));
}

/** @deprecated use remainingKitUnits */
export const remainingKitVials = remainingKitUnits;

export function isTenMultiple(total: number): boolean {
  return Number.isInteger(total) && total > 0 && total % KIT_SIZE_STEP === 0;
}

/** Partial allocation while building a kit — may be below kit size. */
export function validateKitAllocation(
  kitSize: number,
  participants: readonly Pick<KitShareParticipant, "quantity">[],
): { ok: true; total: number } | { ok: false; message: string; total: number } {
  const total = totalAllocatedUnits(participants);
  if (total > kitSize) {
    return { ok: false, message: KIT_OVERFLOW_MESSAGE, total };
  }
  return { ok: true, total };
}

/** Full distribution save — must exactly match kit size and respect the 10-unit rule. */
export function validateFullKitDistribution(
  kitSize: number,
  participants: readonly Pick<KitShareParticipant, "quantity">[],
): { ok: true; total: number } | { ok: false; message: string; total: number } {
  const total = totalAllocatedUnits(participants);
  if (!isValidKitSize(kitSize)) {
    return { ok: false, message: KIT_INVALID_DISTRIBUTION_MESSAGE, total };
  }
  if (total !== kitSize) {
    return { ok: false, message: KIT_INCOMPLETE_DISTRIBUTION_MESSAGE, total };
  }
  if (!isTenMultiple(total)) {
    return { ok: false, message: KIT_INVALID_TOTAL_MESSAGE, total };
  }
  return { ok: true, total };
}

export function canOrderKitShare(
  kitSize: number,
  participants: readonly Pick<KitShareParticipant, "quantity">[],
): boolean {
  return validateFullKitDistribution(kitSize, participants).ok;
}

export function hasDuplicateParticipant(
  participants: readonly KitShareParticipant[],
  userId: string,
): boolean {
  return participants.some((p) => p.userId === userId);
}

/** Base participant share before role markup: kit_price × participant_units / kit_size. */
export function baseUnitPriceUsd(
  kitTotalUsd: number,
  kitSize: number,
  participantUnits: number,
): number {
  if (kitSize <= 0) return 0;
  return roundCurrency((kitTotalUsd * participantUnits) / kitSize);
}

/** @deprecated use baseUnitPriceUsd */
export function participantBaseShareUsd(
  kitTotalUsd: number,
  kitSizeUnits: number,
  participantUnits: number,
): number {
  return baseUnitPriceUsd(kitTotalUsd, kitSizeUnits, participantUnits);
}

/** Role-aware participant price — only compute for the requesting user's share. */
export function participantRoleShareUsd(
  kitTotalUsd: number,
  kitSize: number,
  participantUnits: number,
  markupPercent: number,
): number {
  const baseShare = baseUnitPriceUsd(kitTotalUsd, kitSize, participantUnits);
  return roundCurrency(applyRoleMarkup(baseShare, markupPercent));
}

/**
 * Catalog unit count encoded in one `price_usd` row (10 vials for peptides/water, 1 piece for oils/orals).
 * @deprecated Prefer `catalogPackSize` from `@/lib/shop/kitSharePricing`.
 */
export function catalogUnitsPerPrice(hasBulkTier: boolean): number {
  return hasBulkTier ? 1 : KIT_SIZE_MIN;
}

export function createKitShareDraft(input: {
  product: { id: string; code: string; name: string };
  kitSizeUnits: number;
  creatorUserId: string;
  creatorDisplayName: string;
  creatorQuantity: number;
}): KitShareDraft | null {
  if (!isValidKitSize(input.kitSizeUnits)) return null;
  if (input.creatorQuantity < 1 || input.creatorQuantity > input.kitSizeUnits) return null;

  return {
    productId: input.product.id,
    productCode: input.product.code,
    productName: input.product.name,
    kitSizeUnits: input.kitSizeUnits,
    creatorUserId: input.creatorUserId,
    participants: [
      {
        userId: input.creatorUserId,
        displayName: input.creatorDisplayName,
        quantity: input.creatorQuantity,
      },
    ],
    status: kitShareStatus(input.creatorQuantity, input.kitSizeUnits),
  };
}

export function addKitParticipant(
  draft: KitShareDraft,
  participant: KitShareParticipant,
): { ok: true; draft: KitShareDraft } | { ok: false; message: string } {
  if (hasDuplicateParticipant(draft.participants, participant.userId)) {
    return { ok: false, message: "Dieses Mitglied ist bereits Teil des Kits." };
  }
  if (participant.userId === draft.creatorUserId) {
    return { ok: false, message: "Du bist bereits Teilnehmer dieses Kits." };
  }

  const nextParticipants = [...draft.participants, participant];
  const validation = validateKitAllocation(draft.kitSizeUnits, nextParticipants);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const total = validation.total;
  return {
    ok: true,
    draft: {
      ...draft,
      participants: nextParticipants,
      status: kitShareStatus(total, draft.kitSizeUnits),
    },
  };
}

export function updateParticipantQuantity(
  draft: KitShareDraft,
  userId: string,
  quantity: number,
  actingUserId: string,
): { ok: true; draft: KitShareDraft } | { ok: false; message: string } {
  const isCreator = actingUserId === draft.creatorUserId;
  const isSelf = actingUserId === userId;
  if (!isCreator && !isSelf) {
    return { ok: false, message: "Keine Berechtigung, diese Menge zu ändern." };
  }
  if (quantity < 1) {
    return { ok: false, message: "Die Menge muss mindestens 1 betragen." };
  }

  const nextParticipants = draft.participants.map((p) =>
    p.userId === userId ? { ...p, quantity } : p,
  );
  const validation = validateKitAllocation(draft.kitSizeUnits, nextParticipants);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  return {
    ok: true,
    draft: {
      ...draft,
      participants: nextParticipants,
      status: kitShareStatus(validation.total, draft.kitSizeUnits),
    },
  };
}

/** Creator replaces the full participant distribution atomically. */
export function updateKitDistribution(
  draft: KitShareDraft,
  updates: readonly { userId: string; quantity: number }[],
  actingUserId: string,
): { ok: true; draft: KitShareDraft } | { ok: false; message: string } {
  if (actingUserId !== draft.creatorUserId) {
    return { ok: false, message: "Nur der Ersteller kann die Verteilung bearbeiten." };
  }

  const byId = new Map(updates.map((u) => [u.userId, u.quantity]));
  const nextParticipants = draft.participants.map((p) => {
    const qty = byId.get(p.userId);
    if (qty == null || qty < 1) {
      throw new Error("missing participant in distribution update");
    }
    return { ...p, quantity: qty };
  });

  if (nextParticipants.length !== draft.participants.length) {
    return { ok: false, message: KIT_INVALID_DISTRIBUTION_MESSAGE };
  }

  const validation = validateFullKitDistribution(draft.kitSizeUnits, nextParticipants);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  return {
    ok: true,
    draft: {
      ...draft,
      participants: nextParticipants,
      status: "FULLY_ALLOCATED",
    },
  };
}

/** Suggest balancing another participant when one quantity changes. */
export function suggestBalancedQuantity(
  kitSize: number,
  participants: readonly KitShareParticipant[],
  changedUserId: string,
  newQuantity: number,
): number | null {
  const others = participants.filter((p) => p.userId !== changedUserId);
  if (others.length !== 1) return null;
  const remainder = kitSize - newQuantity;
  if (remainder < 1) return null;
  return remainder;
}

export function removeKitParticipant(
  draft: KitShareDraft,
  userId: string,
  actingUserId: string,
): { ok: true; draft: KitShareDraft } | { ok: false; message: string } {
  if (actingUserId !== draft.creatorUserId) {
    return { ok: false, message: "Nur der Ersteller kann Teilnehmer entfernen." };
  }
  if (userId === draft.creatorUserId) {
    return { ok: false, message: "Der Ersteller kann nicht entfernt werden." };
  }

  const nextParticipants = draft.participants.filter((p) => p.userId !== userId);
  const total = totalAllocatedUnits(nextParticipants);
  return {
    ok: true,
    draft: {
      ...draft,
      participants: nextParticipants,
      status: kitShareStatus(total, draft.kitSizeUnits),
    },
  };
}

/** Strip foreign participant prices from a client payload — only expose own share metadata. */
export function sanitizeKitShareForViewer<T extends KitShareDraft>(
  draft: T,
  viewerUserId: string,
): {
  productName: string;
  kitSizeUnits: number;
  myQuantity: number;
  allocatedTotal: number;
  remaining: number;
  status: KitShareStatus;
  canOrder: boolean;
  participantNames: string[];
} {
  const mine = draft.participants.find((p) => p.userId === viewerUserId);
  const allocatedTotal = totalAllocatedUnits(draft.participants);
  return {
    productName: draft.productName,
    kitSizeUnits: draft.kitSizeUnits,
    myQuantity: mine?.quantity ?? 0,
    allocatedTotal,
    remaining: remainingKitUnits(draft.kitSizeUnits, draft.participants),
    status: draft.status,
    canOrder: canOrderKitShare(draft.kitSizeUnits, draft.participants),
    participantNames: draft.participants.map((p) => p.displayName),
  };
}

/** @deprecated use kitSizeUnits on KitShareDraft */
export function kitSizeVialsFromDraft(draft: KitShareDraft): number {
  return draft.kitSizeUnits;
}

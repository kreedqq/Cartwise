import { applyRoleMarkup, roundCurrency } from "@/lib/money";
import { kitSizeVialsForProduct } from "@/lib/shop/variantCoverage";

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
  kitSizeVials: number;
  creatorUserId: string;
  participants: KitShareParticipant[];
  status: KitShareStatus;
}

export const KIT_OVERFLOW_MESSAGE = "Die gewünschte Menge überschreitet die verfügbare Kitmenge.";

export function kitShareStatus(totalAllocated: number, kitSize: number): KitShareStatus {
  if (totalAllocated <= 0) return "OPEN";
  if (totalAllocated >= kitSize) return "FULLY_ALLOCATED";
  return "PARTIALLY_ALLOCATED";
}

export function totalAllocatedVials(participants: readonly Pick<KitShareParticipant, "quantity">[]): number {
  return participants.reduce((sum, p) => sum + p.quantity, 0);
}

export function remainingKitVials(
  kitSize: number,
  participants: readonly Pick<KitShareParticipant, "quantity">[],
): number {
  return Math.max(0, kitSize - totalAllocatedVials(participants));
}

export function validateKitAllocation(
  kitSize: number,
  participants: readonly Pick<KitShareParticipant, "quantity">[],
): { ok: true } | { ok: false; message: string; total: number } {
  const total = totalAllocatedVials(participants);
  if (total > kitSize) {
    return { ok: false, message: KIT_OVERFLOW_MESSAGE, total };
  }
  return { ok: true };
}

export function canOrderKitShare(
  kitSize: number,
  participants: readonly Pick<KitShareParticipant, "quantity">[],
): boolean {
  return totalAllocatedVials(participants) === kitSize && kitSize > 0;
}

export function hasDuplicateParticipant(
  participants: readonly KitShareParticipant[],
  userId: string,
): boolean {
  return participants.some((p) => p.userId === userId);
}

/** Base kit unit price per vial before role markup. */
export function baseVialPriceUsd(kitTotalUsd: number, kitSizeVials: number): number {
  if (kitSizeVials <= 0) return 0;
  return roundCurrency(kitTotalUsd / kitSizeVials);
}

/** Participant share at catalog/base price (no role markup). */
export function participantBaseShareUsd(
  kitTotalUsd: number,
  kitSizeVials: number,
  participantVials: number,
): number {
  return roundCurrency(baseVialPriceUsd(kitTotalUsd, kitSizeVials) * participantVials);
}

/** Role-aware participant price — only compute for the requesting user's share. */
export function participantRoleShareUsd(
  kitTotalUsd: number,
  kitSizeVials: number,
  participantVials: number,
  markupPercent: number,
): number {
  const baseShare = participantBaseShareUsd(kitTotalUsd, kitSizeVials, participantVials);
  return roundCurrency(applyRoleMarkup(baseShare, markupPercent));
}

export function createKitShareDraft(input: {
  product: { id: string; code: string; name: string };
  creatorUserId: string;
  creatorDisplayName: string;
  creatorQuantity: number;
}): KitShareDraft | null {
  const kitSize = kitSizeVialsForProduct(input.product);
  if (kitSize == null || kitSize < 2) return null;
  if (input.creatorQuantity < 1 || input.creatorQuantity > kitSize) return null;

  return {
    productId: input.product.id,
    productCode: input.product.code,
    productName: input.product.name,
    kitSizeVials: kitSize,
    creatorUserId: input.creatorUserId,
    participants: [
      {
        userId: input.creatorUserId,
        displayName: input.creatorDisplayName,
        quantity: input.creatorQuantity,
      },
    ],
    status: kitShareStatus(input.creatorQuantity, kitSize),
  };
}

export function addKitParticipant(
  draft: KitShareDraft,
  participant: KitShareParticipant,
): { ok: true; draft: KitShareDraft } | { ok: false; message: string } {
  if (participant.userId === draft.creatorUserId && draft.participants.some((p) => p.userId === participant.userId)) {
    return { ok: false, message: "Dieses Mitglied ist bereits Teil des Kits." };
  }
  if (hasDuplicateParticipant(draft.participants, participant.userId)) {
    return { ok: false, message: "Dieses Mitglied ist bereits Teil des Kits." };
  }
  if (participant.userId === draft.creatorUserId) {
    return { ok: false, message: "Du bist bereits Teilnehmer dieses Kits." };
  }

  const nextParticipants = [...draft.participants, participant];
  const validation = validateKitAllocation(draft.kitSizeVials, nextParticipants);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const total = totalAllocatedVials(nextParticipants);
  return {
    ok: true,
    draft: {
      ...draft,
      participants: nextParticipants,
      status: kitShareStatus(total, draft.kitSizeVials),
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
    return { ok: false, message: "Die Menge muss mindestens 1 Vial betragen." };
  }

  const nextParticipants = draft.participants.map((p) =>
    p.userId === userId ? { ...p, quantity } : p,
  );
  const validation = validateKitAllocation(draft.kitSizeVials, nextParticipants);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const total = totalAllocatedVials(nextParticipants);
  return {
    ok: true,
    draft: {
      ...draft,
      participants: nextParticipants,
      status: kitShareStatus(total, draft.kitSizeVials),
    },
  };
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
  const total = totalAllocatedVials(nextParticipants);
  return {
    ok: true,
    draft: {
      ...draft,
      participants: nextParticipants,
      status: kitShareStatus(total, draft.kitSizeVials),
    },
  };
}

/** Strip foreign participant prices from a client payload — only expose own share metadata. */
export function sanitizeKitShareForViewer<T extends KitShareDraft>(
  draft: T,
  viewerUserId: string,
): {
  productName: string;
  kitSizeVials: number;
  myQuantity: number;
  allocatedTotal: number;
  remaining: number;
  status: KitShareStatus;
  canOrder: boolean;
  participantNames: string[];
} {
  const mine = draft.participants.find((p) => p.userId === viewerUserId);
  const allocatedTotal = totalAllocatedVials(draft.participants);
  return {
    productName: draft.productName,
    kitSizeVials: draft.kitSizeVials,
    myQuantity: mine?.quantity ?? 0,
    allocatedTotal,
    remaining: remainingKitVials(draft.kitSizeVials, draft.participants),
    status: draft.status,
    canOrder: canOrderKitShare(draft.kitSizeVials, draft.participants),
    participantNames: draft.participants.map((p) => p.displayName),
  };
}

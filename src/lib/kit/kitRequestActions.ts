import { KIT_ALMOST_FULL_REMAINING_THRESHOLD } from "@/lib/kit/kitShareState";
import type { KitRequestCard } from "@/services/kitRequests";

export type KitRequestActionKind =
  | "join"
  | "change_quantity"
  | "leave"
  | "cancel"
  | "retry_cart"
  | "view_mine"
  | "full"
  | "expired"
  | "cancelled"
  | "ordered"
  | "locked"
  | "none";

export function kitRequestPrimaryAction(request: KitRequestCard): KitRequestActionKind {
  if (request.status === "open") {
    if (request.isCreator) return "view_mine";
    if (request.isParticipant) return "locked";
    if (request.remainingVials > 0) return "join";
  }
  if (request.status === "full") {
    if (request.isParticipant || request.isCreator) return "retry_cart";
    return "full";
  }
  if (request.status === "expired") return "expired";
  if (request.status === "cancelled") return "cancelled";
  if (request.status === "ordered") return "ordered";
  return "none";
}

export function kitRequestActionLabel(kind: KitRequestActionKind): string {
  switch (kind) {
    case "join":
      return "Mitmachen";
    case "change_quantity":
      return "Menge ändern";
    case "view_mine":
      return "Mein Gesuch";
    case "full":
      return "Kit voll";
    case "expired":
      return "Abgelaufen";
    case "cancelled":
      return "Storniert";
    case "ordered":
      return "Bestellt";
    case "locked":
      return "Gesperrt";
    case "retry_cart":
      return "Warenkorb aktualisieren";
    case "leave":
      return "Kit verlassen";
    case "cancel":
      return "Kit stornieren";
    default:
      return "";
  }
}

export function kitRequestIsAlmostFull(request: KitRequestCard): boolean {
  return (
    request.status === "open" &&
    request.remainingVials > 0 &&
    request.remainingVials <= KIT_ALMOST_FULL_REMAINING_THRESHOLD
  );
}

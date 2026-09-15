import type { KitShareView } from "@/services/kitShares";

export type KitShareCustomerLockReason = "full" | "partial_order" | "ordered";

export function isKitShareStatusCustomerLocked(status: string): boolean {
  return status === "full" || status === "ordered";
}

export function kitShareCustomerLockHint(
  locked: boolean,
  reason: KitShareCustomerLockReason | null | undefined,
): string | null {
  if (!locked) return null;
  if (reason === "partial_order" || reason === "ordered") {
    return "Dieses Kit wurde bereits teilweise bestellt und ist gesperrt.";
  }
  return "Dieses Kit ist vollständig und wurde gesperrt.";
}

export function kitShareCustomerLockedFromView(view: Pick<KitShareView, "customerMutationLocked" | "status">): boolean {
  return view.customerMutationLocked ?? isKitShareStatusCustomerLocked(view.status);
}

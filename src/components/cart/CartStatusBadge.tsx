import { Badge } from "@/components/ui/badge";
import type { CartStatus } from "@/types/database";

export const CART_STATUS_LABELS: Record<CartStatus, string> = {
  draft: "Entwurf",
  ready: "Bereit zur Bestellung",
  ordered: "Bestellt",
  archived: "Archiviert",
};

const CART_STATUS_VARIANTS: Record<CartStatus, "secondary" | "warning" | "success" | "outline"> = {
  draft: "secondary",
  ready: "warning",
  ordered: "success",
  archived: "outline",
};

export function CartStatusBadge({ status }: { status: CartStatus }) {
  return <Badge variant={CART_STATUS_VARIANTS[status]}>{CART_STATUS_LABELS[status]}</Badge>;
}

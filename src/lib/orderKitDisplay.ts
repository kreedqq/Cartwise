import {
  asQuantity,
  formatCatalogQuantity,
  formatKitParticipantShare,
  resolveProductCategoryId,
} from "@/lib/quantityFormat";
import type { Tables } from "@/types/database";

export type HistoricalOrderItemQuantityInput = Pick<
  Tables<"order_items">,
  | "quantity"
  | "kit_share_id_snapshot"
  | "kit_size_vials_snapshot"
  | "kit_participant_quantity_snapshot"
  | "product_name_snapshot"
  | "product_code_snapshot"
  | "dosage_vial_snapshot"
>;

/** Kit size for display: frozen snapshot first, then optional legacy fallback. */
export function kitSizeFromOrderItem(
  item: Pick<Tables<"order_items">, "kit_size_vials_snapshot" | "product_name_snapshot" | "product_code_snapshot">,
  legacyKitSize?: number | null,
): number | null {
  const snap = asQuantity(item.kit_size_vials_snapshot);
  if (snap > 0) return snap;
  const legacy = asQuantity(legacyKitSize);
  return legacy > 0 ? legacy : null;
}

export function isKitOrderLine(
  item: Pick<Tables<"order_items">, "kit_share_id_snapshot">,
): boolean {
  return Boolean(item.kit_share_id_snapshot?.trim());
}

export function formatKitShareLabelForOrderItem(
  item: HistoricalOrderItemQuantityInput,
): string | null {
  if (!item.kit_share_id_snapshot?.trim()) return null;
  const kitSize = asQuantity(item.kit_size_vials_snapshot);
  if (kitSize <= 0) return null;
  const shareQty = asQuantity(item.kit_participant_quantity_snapshot ?? item.quantity);
  const categoryId = resolveProductCategoryId({
    name: item.product_name_snapshot,
    code: item.product_code_snapshot,
    dosageVial: item.dosage_vial_snapshot,
  });
  return formatKitParticipantShare(shareQty, kitSize, categoryId);
}

/** Frozen order line quantity: kit fraction only when kit_share_id_snapshot exists. */
export function formatHistoricalOrderItemQuantity(item: HistoricalOrderItemQuantityInput): string {
  const kitLabel = formatKitShareLabelForOrderItem(item);
  if (kitLabel) return kitLabel;
  const categoryId = resolveProductCategoryId({
    name: item.product_name_snapshot,
    code: item.product_code_snapshot,
    dosageVial: item.dosage_vial_snapshot,
  });
  // Standalone catalog lines (no kit share) use Kit nouns for peptide/water group-buy SKUs.
  return formatCatalogQuantity(asQuantity(item.quantity), categoryId, "catalog");
}

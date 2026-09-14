import { asQuantity, formatPartialKitQuantity } from "@/lib/quantityFormat";
import { resolveProductCategoryId } from "@/lib/quantityFormat";
import type { Tables } from "@/types/database";

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
  item: Pick<
    Tables<"order_items">,
    | "kit_share_id_snapshot"
    | "quantity"
    | "kit_size_vials_snapshot"
    | "kit_participant_quantity_snapshot"
    | "product_name_snapshot"
    | "product_code_snapshot"
  >,
): string | null {
  if (!item.kit_share_id_snapshot?.trim()) return null;
  const kitSize = asQuantity(item.kit_size_vials_snapshot);
  if (kitSize <= 0) return null;
  const shareQty = asQuantity(item.kit_participant_quantity_snapshot ?? item.quantity);
  const categoryId = resolveProductCategoryId({
    name: item.product_name_snapshot,
    code: item.product_code_snapshot,
  });
  return formatPartialKitQuantity(shareQty, kitSize, categoryId);
}

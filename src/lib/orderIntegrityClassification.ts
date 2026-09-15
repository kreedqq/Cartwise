/**
 * Read-only classification helpers for historical order/cart anomalies.
 * Does not mutate data or infer repairs.
 */

export type IntegrityCaseCategory =
  | "valid_legacy_state"
  | "provable_missing_link"
  | "provable_integrity_error"
  | "ambiguous"
  | "unknown"
  | "expected_remaining_cart";

export type LegacyOrderAuditRow = {
  orderNumber: string;
  orderItemCount: number;
  linesLinked: number;
  linesUnlinked: number;
  shopArea: string | null;
};

export function classifyLegacyZeroLinkedOrder(row: LegacyOrderAuditRow): IntegrityCaseCategory {
  if (row.orderItemCount <= 0) return "unknown";
  if (row.linesLinked > 0) return "valid_legacy_state";
  if (row.linesUnlinked > 0 && row.orderItemCount > 0) {
    return "valid_legacy_state";
  }
  return "unknown";
}

export type KitCartLinkAuditRow = {
  submittedOrderId: string | null;
  participantOrderId: string | null;
  participantOrderedAt: string | null;
  orderNumber: string | null;
  quantityMatches: boolean;
};

export function classifyKitCartMissingLink(row: KitCartLinkAuditRow): IntegrityCaseCategory {
  if (row.submittedOrderId) return "valid_legacy_state";
  if (!row.participantOrderedAt) return "unknown";
  if (row.participantOrderId && row.orderNumber && row.quantityMatches) {
    return "provable_missing_link";
  }
  if (row.participantOrderedAt && !row.participantOrderId && !row.orderNumber) {
    return "ambiguous";
  }
  return "unknown";
}

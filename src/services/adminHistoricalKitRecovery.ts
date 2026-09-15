import { supabase } from "@/lib/supabaseClient";
import { extractRpcErrorMessage } from "@/services/username";

export type HistoricalKitRecoveryStatus =
  | "recovery_candidate"
  | "recovery_verified"
  | "recovery_blocked"
  | "recovery_already_applied"
  | "recovery_failed";

export interface HistoricalKitRecoveryPreview {
  status: HistoricalKitRecoveryStatus;
  reason?: string;
  orderId?: string;
  orderNumber?: string;
  customerUserId?: string;
  kitShareId?: string;
  productCode?: string;
  productName?: string;
  dosageVial?: string | null;
  kitSizeVials?: number;
  participantQuantity?: number;
  kitCompletedAt?: string;
  checkoutAt?: string;
  participantJoinedAt?: string;
  historicalUnitPriceUsd?: number;
  missingLineTotalUsd?: number;
  missingLineTotalEur?: number | null;
  currentOrderTotalUsd?: number;
  currentOrderTotalEur?: number | null;
  newOrderTotalUsd?: number;
  newOrderTotalEur?: number | null;
  exchangeRate?: number | null;
  expectedRevision?: number;
  recoveryReason?: string;
}

export interface ApplyHistoricalKitRecoveryResult {
  orderId: string;
  orderItemId: string;
  revisionNumber: number;
  previousTotalUsd: number;
  newTotalUsd: number;
  differenceUsd: number;
  missingLineTotalUsd: number;
  missingLineTotalEur: number | null;
}

function mapPreview(data: Record<string, unknown>): HistoricalKitRecoveryPreview {
  return {
    status: String(data.status ?? "recovery_failed") as HistoricalKitRecoveryStatus,
    reason: data.reason != null ? String(data.reason) : undefined,
    orderId: data.orderId != null ? String(data.orderId) : undefined,
    orderNumber: data.orderNumber != null ? String(data.orderNumber) : undefined,
    customerUserId: data.customerUserId != null ? String(data.customerUserId) : undefined,
    kitShareId: data.kitShareId != null ? String(data.kitShareId) : undefined,
    productCode: data.productCode != null ? String(data.productCode) : undefined,
    productName: data.productName != null ? String(data.productName) : undefined,
    dosageVial: data.dosageVial != null ? String(data.dosageVial) : null,
    kitSizeVials: data.kitSizeVials != null ? Number(data.kitSizeVials) : undefined,
    participantQuantity: data.participantQuantity != null ? Number(data.participantQuantity) : undefined,
    kitCompletedAt: data.kitCompletedAt != null ? String(data.kitCompletedAt) : undefined,
    checkoutAt: data.checkoutAt != null ? String(data.checkoutAt) : undefined,
    participantJoinedAt: data.participantJoinedAt != null ? String(data.participantJoinedAt) : undefined,
    historicalUnitPriceUsd:
      data.historicalUnitPriceUsd != null ? Number(data.historicalUnitPriceUsd) : undefined,
    missingLineTotalUsd: data.missingLineTotalUsd != null ? Number(data.missingLineTotalUsd) : undefined,
    missingLineTotalEur:
      data.missingLineTotalEur != null ? Number(data.missingLineTotalEur) : null,
    currentOrderTotalUsd: data.currentOrderTotalUsd != null ? Number(data.currentOrderTotalUsd) : undefined,
    currentOrderTotalEur:
      data.currentOrderTotalEur != null ? Number(data.currentOrderTotalEur) : null,
    newOrderTotalUsd: data.newOrderTotalUsd != null ? Number(data.newOrderTotalUsd) : undefined,
    newOrderTotalEur: data.newOrderTotalEur != null ? Number(data.newOrderTotalEur) : null,
    exchangeRate: data.exchangeRate != null ? Number(data.exchangeRate) : null,
    expectedRevision: data.expectedRevision != null ? Number(data.expectedRevision) : undefined,
    recoveryReason: data.recoveryReason != null ? String(data.recoveryReason) : undefined,
  };
}

export async function evaluateHistoricalKitRecovery(input: {
  orderId: string;
  kitShareId: string;
}): Promise<HistoricalKitRecoveryPreview> {
  const { data, error } = await supabase.rpc("kit_sync_recovery_evaluate", {
    _order_id: input.orderId,
    _kit_share_id: input.kitShareId,
  });

  if (error) {
    throw new Error(extractRpcErrorMessage(error).trim() || "Vorschau fehlgeschlagen.");
  }

  return mapPreview((data ?? {}) as Record<string, unknown>);
}

export async function applyHistoricalKitRecovery(input: {
  orderId: string;
  kitShareId: string;
  expectedRevision: number;
  reason: string;
}): Promise<ApplyHistoricalKitRecoveryResult> {
  const { data, error } = await supabase.rpc("admin_apply_historical_kit_sync_recovery", {
    _order_id: input.orderId,
    _expected_revision: input.expectedRevision,
    _kit_share_id: input.kitShareId,
    _reason: input.reason,
  });

  if (error) {
    throw new Error(extractRpcErrorMessage(error).trim() || "Historische Korrektur fehlgeschlagen.");
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    orderId: String(row.orderId ?? input.orderId),
    orderItemId: String(row.orderItemId),
    revisionNumber: Number(row.revisionNumber),
    previousTotalUsd: Number(row.previousTotalUsd),
    newTotalUsd: Number(row.newTotalUsd),
    differenceUsd: Number(row.differenceUsd),
    missingLineTotalUsd: Number(row.missingLineTotalUsd),
    missingLineTotalEur: row.missingLineTotalEur != null ? Number(row.missingLineTotalEur) : null,
  };
}

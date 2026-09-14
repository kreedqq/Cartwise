import { supabase } from "@/lib/supabaseClient";
import { extractRpcErrorMessage } from "@/services/username";
import type { Tables } from "@/types/database";

export interface OrderLineChangeInput {
  orderItemId: string;
  quantity?: number;
  remove?: boolean;
}

export interface ApplyOrderCorrectionResult {
  orderId: string;
  revisionNumber: number;
  previousTotalUsd: number;
  newTotalUsd: number;
  differenceUsd: number;
}

export async function listOrderRevisions(orderId: string): Promise<Tables<"order_revisions">[]> {
  const { data, error } = await supabase
    .from("order_revisions")
    .select("*")
    .eq("order_id", orderId)
    .order("revision_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tables<"order_revisions">[];
}

export async function applyOrderCorrection(input: {
  orderId: string;
  expectedRevision: number;
  reason: string;
  lineChanges: OrderLineChangeInput[];
}): Promise<ApplyOrderCorrectionResult> {
  const _line_changes = input.lineChanges.map((line) => {
    if (line.remove) {
      return { orderItemId: line.orderItemId, remove: true };
    }
    return { orderItemId: line.orderItemId, quantity: line.quantity };
  });

  const { data, error } = await supabase.rpc("admin_apply_order_correction", {
    _order_id: input.orderId,
    _expected_revision: input.expectedRevision,
    _reason: input.reason,
    _line_changes,
  });

  if (error) {
    throw new Error(extractRpcErrorMessage(error).trim() || "Korrektur fehlgeschlagen.");
  }

  const row = data as Record<string, unknown>;
  return {
    orderId: String(row.orderId ?? input.orderId),
    revisionNumber: Number(row.revisionNumber),
    previousTotalUsd: Number(row.previousTotalUsd),
    newTotalUsd: Number(row.newTotalUsd),
    differenceUsd: Number(row.differenceUsd),
  };
}

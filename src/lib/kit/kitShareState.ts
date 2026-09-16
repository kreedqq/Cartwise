/** Must match SQL constant in kit_share_project_state (migration 0108). */
export const KIT_ALMOST_FULL_REMAINING_THRESHOLD = 2;

export type KitShareProjectedState = {
  status: string;
  allocatedQuantity: number;
  kitSize: number;
  remainingQuantity: number;
  isAlmostFull: boolean;
  isFull: boolean;
  isJoinable: boolean;
  isEditable: boolean;
  isOrdered: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  isLocked: boolean;
  displayStatusLabel: string;
};

export function projectKitShareState(input: {
  status: string;
  allocatedQuantity: number;
  kitSize: number;
  isLocked?: boolean;
  isOpenRequest?: boolean;
}): KitShareProjectedState {
  const allocated = Number.isFinite(input.allocatedQuantity) ? Math.max(0, input.allocatedQuantity) : 0;
  const kitSize = Number.isFinite(input.kitSize) ? Math.max(0, input.kitSize) : 0;
  const remaining = Math.max(0, kitSize - allocated);
  const status = input.status;

  const isOrdered = status === "ordered";
  const isCancelled = status === "cancelled";
  const isExpired = status === "expired";
  const isFull = status === "full" || (kitSize > 0 && allocated === kitSize);
  const isAlmostFull =
    status === "open" && remaining > 0 && remaining <= KIT_ALMOST_FULL_REMAINING_THRESHOLD;
  const isLocked = Boolean(input.isLocked) || isOrdered;

  const isJoinable =
    Boolean(input.isOpenRequest) &&
    status === "open" &&
    remaining > 0 &&
    !isExpired &&
    !isCancelled &&
    !isLocked;

  const isEditable = status === "open" && !isLocked && !isFull && !isCancelled && !isExpired;

  let displayStatusLabel = kitShareDbStatusLabel(status);
  if (isAlmostFull) displayStatusLabel = "Fast voll";

  return {
    status,
    allocatedQuantity: allocated,
    kitSize,
    remainingQuantity: remaining,
    isAlmostFull,
    isFull,
    isJoinable,
    isEditable,
    isOrdered,
    isCancelled,
    isExpired,
    isLocked,
    displayStatusLabel,
  };
}

const DB_STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  full: "Voll",
  cancelled: "Storniert",
  expired: "Abgelaufen",
  ordered: "Bestellt",
};

function kitShareDbStatusLabel(status: string): string {
  if (status === "cancelled") return "Abgebrochen";
  return DB_STATUS_LABELS[status] ?? status;
}

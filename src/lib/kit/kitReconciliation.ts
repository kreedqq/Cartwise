import { projectKitShareState, type KitShareProjectedState } from "@/lib/kit/kitShareState";

export const KIT_RECONCILE_CODES = [
  "HEALTHY",
  "MISSING_CART_LINE",
  "WRONG_CART_QUANTITY",
  "DUPLICATE_CART_LINE",
  "WRONG_AREA",
  "WRONG_KIT_SHARE",
  "ORDER_MISMATCH",
  "HISTORICAL_ORDER_SNAPSHOT_MISMATCH",
  "ALLOCATION_OVERFLOW",
  "LOCKED",
  "ORDERED",
  "CANCELLED",
  "UNKNOWN",
  "NEEDS_ATTENTION",
] as const;

export type KitReconcileCode = (typeof KIT_RECONCILE_CODES)[number];

export type KitReconcileIssue = {
  code: string;
  severity: string;
  userId?: string;
  participantQuantity?: number;
  cartQuantity?: number;
  cartLineCount?: number;
  orderId?: string;
  reason?: string;
  expectedArea?: string;
  cartLineArea?: string;
  orderSnapshotQuantity?: number;
};

export type KitReconcileParticipantRow = {
  userId: string;
  username: string;
  participantQuantity: number;
  cartQuantity: number;
  cartLineCount: number;
  orderId: string | null;
  orderSnapshotQuantity: number | null;
  status: string;
};

export type KitReconcileReport = {
  kitShareId: string;
  checkedAt: string;
  overallStatus: "HEALTHY" | "NEEDS_ATTENTION" | "UNKNOWN";
  state: KitShareProjectedState | null;
  participants: KitReconcileParticipantRow[];
  participantCount: number;
  healthyParticipantCount: number;
  issues: KitReconcileIssue[];
  reconciliationRequired: boolean;
};

const ISSUE_LABELS: Record<string, string> = {
  ALLOCATION_OVERFLOW: "Kit überbelegt",
  MISSING_CART_LINE: "Warenkorbposition fehlt",
  WRONG_CART_QUANTITY: "Warenkorb-Menge weicht ab",
  CART_QUANTITY_MISMATCH: "Warenkorb-Menge weicht ab",
  DUPLICATE_CART_LINE: "Doppelte Warenkorbzeile",
  WRONG_AREA: "Falscher Verkaufsbereich",
  WRONG_KIT_SHARE: "Falsches Kit",
  ORDER_MISMATCH: "Bestellung passt nicht",
  HISTORICAL_ORDER_SNAPSHOT_MISMATCH: "Historische Bestellung (Snapshot)",
  LOCKED: "Gesperrt",
  ORDERED: "Bestellt",
  CANCELLED: "Storniert",
};

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  HEALTHY: "Synchron",
  MISSING_CART_LINE: "Position fehlt",
  WRONG_CART_QUANTITY: "Menge abweichend",
  DUPLICATE_CART_LINE: "Doppelte Zeile",
  WRONG_AREA: "Bereich falsch",
  ORDER_MISMATCH: "Bestellung unklar",
  HISTORICAL_ORDER_SNAPSHOT_MISMATCH: "Historischer Snapshot",
};

export function kitReconcileIssueLabel(code: string): string {
  return ISSUE_LABELS[code] ?? "Abweichung";
}

export function kitReconcileParticipantStatusLabel(status: string): string {
  return PARTICIPANT_STATUS_LABELS[status] ?? status;
}

export function kitReconcileOverallLabel(status: string): string {
  if (status === "HEALTHY") return "Alles synchron";
  if (status === "NEEDS_ATTENTION") return "Abweichung erkannt";
  return "Unbekannt";
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapState(raw: Record<string, unknown> | null): KitShareProjectedState | null {
  if (!raw) return null;
  return projectKitShareState({
    status: String(raw.status ?? ""),
    allocatedQuantity: num(raw.allocatedQuantity),
    kitSize: num(raw.kitSize),
    isLocked: raw.isLocked === true,
    isOpenRequest: raw.isOpenRequest === true,
  });
}

export function parseKitReconcileReport(data: unknown): KitReconcileReport {
  const raw = (data ?? {}) as Record<string, unknown>;
  const stateRaw = raw.state;
  const stateRecord =
    stateRaw && typeof stateRaw === "object" && !Array.isArray(stateRaw)
      ? (stateRaw as Record<string, unknown>)
      : null;

  const participantsRaw = Array.isArray(raw.participants) ? raw.participants : [];
  const issuesRaw = Array.isArray(raw.issues) ? raw.issues : [];

  return {
    kitShareId: String(raw.kitShareId ?? ""),
    checkedAt: String(raw.checkedAt ?? new Date().toISOString()),
    overallStatus:
      raw.overallStatus === "HEALTHY" || raw.overallStatus === "NEEDS_ATTENTION"
        ? raw.overallStatus
        : "UNKNOWN",
    state: mapState(stateRecord),
    participants: participantsRaw.map((row) => {
      const p = row as Record<string, unknown>;
      return {
        userId: String(p.userId ?? ""),
        username: String(p.username ?? ""),
        participantQuantity: num(p.participantQuantity),
        cartQuantity: num(p.cartQuantity),
        cartLineCount: num(p.cartLineCount),
        orderId: p.orderId == null ? null : String(p.orderId),
        orderSnapshotQuantity:
          p.orderSnapshotQuantity == null ? null : num(p.orderSnapshotQuantity),
        status: String(p.status ?? "UNKNOWN"),
      };
    }),
    participantCount: num(raw.participantCount),
    healthyParticipantCount: num(raw.healthyParticipantCount),
    issues: issuesRaw.map((row) => row as KitReconcileIssue),
    reconciliationRequired: raw.reconciliationRequired === true,
  };
}

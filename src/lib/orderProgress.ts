import type { OrderStatus } from "@/types/database";

export const ORDER_PROGRESS_STATUS_KEYS = [
  "received",
  "processing",
  "submitted",
  "preparing_shipment",
  "shipped",
  "out_for_delivery",
  "arrived",
  "completed",
] as const;

export type OrderProgressStatusKey = (typeof ORDER_PROGRESS_STATUS_KEYS)[number];

export interface OrderProgressStatusOption {
  key: OrderProgressStatusKey;
  label: string;
  defaultPercent: number;
  defaultComment: string;
}

export const ORDER_PROGRESS_STATUS_OPTIONS: readonly OrderProgressStatusOption[] = [
  {
    key: "received",
    label: "Bestellung eingegangen",
    defaultPercent: 12,
    defaultComment: "Ihre Bestellung ist eingegangen.",
  },
  {
    key: "processing",
    label: "In Bearbeitung",
    defaultPercent: 28,
    defaultComment: "Ihre Bestellung befindet sich in Bearbeitung.",
  },
  {
    key: "submitted",
    label: "Bestellung wurde übermittelt",
    defaultPercent: 45,
    defaultComment: "Ihre Bestellung wurde erfolgreich übermittelt und wird nun weiterbearbeitet.",
  },
  {
    key: "preparing_shipment",
    label: "Versand vorbereitet",
    defaultPercent: 62,
    defaultComment: "Ihre Bestellung wird für den Versand vorbereitet.",
  },
  {
    key: "shipped",
    label: "Versendet",
    defaultPercent: 75,
    defaultComment: "Ihre Bestellung wurde versendet.",
  },
  {
    key: "out_for_delivery",
    label: "In Zustellung",
    defaultPercent: 88,
    defaultComment: "Ihre Bestellung ist unterwegs und befindet sich in der Zustellung.",
  },
  {
    key: "arrived",
    label: "Bestellung angekommen",
    defaultPercent: 96,
    defaultComment: "Ihre Bestellung ist angekommen.",
  },
  {
    key: "completed",
    label: "Abgeschlossen",
    defaultPercent: 100,
    defaultComment: "Ihre Bestellung ist abgeschlossen.",
  },
] as const;

export interface OrderProgressView {
  statusKey: OrderProgressStatusKey;
  statusLabel: string;
  progressPercent: number;
  comment: string;
  updatedAt: string | null;
  isCustom: boolean;
}

export function isOrderProgressStatusKey(value: string | null | undefined): value is OrderProgressStatusKey {
  return Boolean(value && (ORDER_PROGRESS_STATUS_KEYS as readonly string[]).includes(value));
}

export function orderProgressOption(key: OrderProgressStatusKey): OrderProgressStatusOption {
  return ORDER_PROGRESS_STATUS_OPTIONS.find((option) => option.key === key) ?? ORDER_PROGRESS_STATUS_OPTIONS[0];
}

export function clampProgressPercent(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.min(100, Math.round(amount)));
}

/** Visual delivery defaults derived from the workflow status. Never writes to the database. */
export function defaultOrderProgress(orderStatus: OrderStatus, submittedAt?: string | null): OrderProgressView {
  const byWorkflow: Record<OrderStatus, OrderProgressStatusKey> = {
    pending: "received",
    confirmed: "processing",
    processing: "processing",
    dispatched: "submitted",
    received: "preparing_shipment",
    shipped: "shipped",
    completed: "completed",
    cancelled: "received",
  };
  const key = byWorkflow[orderStatus] ?? "received";
  const option = orderProgressOption(key);
  const cancelled = orderStatus === "cancelled";
  return {
    statusKey: option.key,
    statusLabel: cancelled ? "Storniert" : option.label,
    progressPercent: cancelled ? 0 : option.defaultPercent,
    comment: cancelled ? "Diese Bestellung wurde storniert." : option.defaultComment,
    updatedAt: submittedAt ?? null,
    isCustom: false,
  };
}

export function resolveOrderProgress(
  orderStatus: OrderStatus,
  stored: {
    status_key: string;
    progress_percent: number;
    comment: string | null;
    updated_at: string;
  } | null | undefined,
  submittedAt?: string | null,
): OrderProgressView {
  const fallback = defaultOrderProgress(orderStatus, submittedAt);
  if (!stored) return fallback;
  const key = isOrderProgressStatusKey(stored.status_key) ? stored.status_key : fallback.statusKey;
  const option = orderProgressOption(key);
  return {
    statusKey: key,
    statusLabel: option.label,
    progressPercent: clampProgressPercent(stored.progress_percent),
    comment: stored.comment?.trim() || option.defaultComment,
    updatedAt: stored.updated_at,
    isCustom: true,
  };
}

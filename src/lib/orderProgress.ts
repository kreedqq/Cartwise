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

/** Comfort templates only. Admins can change every field afterwards. */
export interface OrderProgressTemplate {
  id: string;
  statusKey: OrderProgressStatusKey;
  title: string;
  description: string;
  percent: number;
}

export const ORDER_PROGRESS_TEMPLATES: readonly OrderProgressTemplate[] = [
  {
    id: "received",
    statusKey: "received",
    title: "Bestellung eingegangen",
    description: "Ihre Bestellung ist eingegangen und wird als Nächstes geprüft.",
    percent: 12,
  },
  {
    id: "processing",
    statusKey: "processing",
    title: "Bestellung wird bearbeitet",
    description: "Wir prüfen aktuell Ihre Bestellung und bereiten die nächsten Schritte vor.",
    percent: 28,
  },
  {
    id: "submitted",
    statusKey: "submitted",
    title: "Bestellung wurde übermittelt",
    description: "Ihre Bestellung wurde erfolgreich übermittelt und wird nun weiterbearbeitet.",
    percent: 45,
  },
  {
    id: "preparing_shipment",
    statusKey: "preparing_shipment",
    title: "Versand wird vorbereitet",
    description: "Ihre Bestellung wird für den Versand vorbereitet.",
    percent: 62,
  },
  {
    id: "shipped",
    statusKey: "shipped",
    title: "Bestellung wurde versendet",
    description: "Ihre Bestellung wurde versendet und kann ab sofort verfolgt werden.",
    percent: 75,
  },
  {
    id: "out_for_delivery",
    statusKey: "out_for_delivery",
    title: "Bestellung ist unterwegs",
    description: "Ihre Bestellung ist unterwegs und befindet sich in der Zustellung.",
    percent: 88,
  },
  {
    id: "arrived",
    statusKey: "arrived",
    title: "Bestellung angekommen",
    description: "Ihre Bestellung ist angekommen.",
    percent: 96,
  },
] as const;

export interface OrderProgressView {
  statusKey: OrderProgressStatusKey;
  statusLabel: string;
  progressPercent: number;
  comment: string;
  updatedAt: string | null;
  isCustom: boolean;
  isCancelled: boolean;
}

export interface StoredOrderProgress {
  status_key: string;
  progress_percent: number;
  comment: string | null;
  title?: string | null;
  updated_at: string;
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
    isCancelled: cancelled,
  };
}

export function resolveOrderProgress(
  orderStatus: OrderStatus,
  stored: StoredOrderProgress | null | undefined,
  submittedAt?: string | null,
): OrderProgressView {
  const fallback = defaultOrderProgress(orderStatus, submittedAt);
  const cancelled = orderStatus === "cancelled";
  if (!stored) return fallback;
  const key = isOrderProgressStatusKey(stored.status_key) ? stored.status_key : fallback.statusKey;
  const option = orderProgressOption(key);
  const title = stored.title?.trim() || option.label;
  const comment = stored.comment?.trim() || option.defaultComment;
  return {
    statusKey: key,
    statusLabel: cancelled ? "Storniert" : title,
    progressPercent: clampProgressPercent(stored.progress_percent),
    comment: cancelled ? stored.comment?.trim() || "Diese Bestellung wurde storniert." : comment,
    updatedAt: stored.updated_at,
    isCustom: true,
    isCancelled: cancelled,
  };
}

export function orderProgressPreviewFromDraft(
  draft: {
    statusKey: OrderProgressStatusKey;
    title: string;
    description: string;
    percent: string | number;
  },
  extras: Pick<OrderProgressView, "updatedAt" | "isCancelled">,
): OrderProgressView {
  return {
    statusKey: draft.statusKey,
    statusLabel: extras.isCancelled ? "Storniert" : draft.title.trim() || "Bestellfortschritt",
    progressPercent: clampProgressPercent(draft.percent),
    comment: extras.isCancelled
      ? draft.description.trim() || "Diese Bestellung wurde storniert."
      : draft.description.trim(),
    updatedAt: extras.updatedAt,
    isCustom: true,
    isCancelled: extras.isCancelled,
  };
}

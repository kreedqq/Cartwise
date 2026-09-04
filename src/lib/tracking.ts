export const TRACKING_CARRIER_KEYS = ["dhl", "dpd", "ups", "gls", "hermes", "other"] as const;

export type TrackingCarrierKey = (typeof TRACKING_CARRIER_KEYS)[number];

export interface TrackingCarrierOption {
  key: TrackingCarrierKey;
  label: string;
}

export const TRACKING_CARRIER_OPTIONS: readonly TrackingCarrierOption[] = [
  { key: "dhl", label: "DHL" },
  { key: "dpd", label: "DPD" },
  { key: "ups", label: "UPS" },
  { key: "gls", label: "GLS" },
  { key: "hermes", label: "Hermes" },
  { key: "other", label: "Andere" },
] as const;

export const EMPTY_ORDER_TRACKING = {
  tracking_number: null as string | null,
  tracking_carrier: null as string | null,
  tracking_url: null as string | null,
  tracking_assigned_at: null as string | null,
  tracking_assigned_by: null as string | null,
  tracking_notification_sent_at: null as string | null,
};

export interface OrderTrackingFields {
  tracking_number: string | null;
  tracking_carrier: string | null;
  tracking_url: string | null;
  tracking_assigned_at: string | null;
  tracking_assigned_by: string | null;
  tracking_notification_sent_at: string | null;
}

export function isTrackingCarrierKey(value: string | null | undefined): value is TrackingCarrierKey {
  return Boolean(value && (TRACKING_CARRIER_KEYS as readonly string[]).includes(value));
}

export function trackingCarrierLabel(carrier: string | null | undefined): string {
  if (!isTrackingCarrierKey(carrier)) return "Versanddienstleister";
  return TRACKING_CARRIER_OPTIONS.find((option) => option.key === carrier)?.label ?? carrier.toUpperCase();
}

export function normalizeTrackingNumber(value: string | null | undefined): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned ? cleaned : null;
}

export function buildCarrierTrackingUrl(
  carrier: TrackingCarrierKey | string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const number = normalizeTrackingNumber(trackingNumber);
  if (!number || !isTrackingCarrierKey(carrier) || carrier === "other") return null;
  const encoded = encodeURIComponent(number);
  switch (carrier) {
    case "dhl":
      return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encoded}`;
    case "dpd":
      return `https://tracking.dpd.de/status/de_DE/parcel/${encoded}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${encoded}`;
    case "gls":
      return `https://gls-group.com/DE/de/paketverfolgung?match=${encoded}`;
    case "hermes":
      return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation?trackingNumber=${encoded}`;
    default:
      return null;
  }
}

export function resolveTrackingUrl(input: {
  carrier: string | null | undefined;
  trackingNumber: string | null | undefined;
  customUrl?: string | null;
}): string | null {
  const custom = input.customUrl?.trim() ?? "";
  if (custom) return custom;
  return buildCarrierTrackingUrl(input.carrier, input.trackingNumber);
}

export function hasTrackingNumber(order: { tracking_number?: string | null }): boolean {
  return Boolean(normalizeTrackingNumber(order.tracking_number));
}

export function shouldSendTrackingNotification(
  previous: {
    tracking_number?: string | null;
    tracking_notification_sent_at?: string | null;
  },
  nextTrackingNumber: string | null | undefined,
): boolean {
  if (!normalizeTrackingNumber(nextTrackingNumber)) return false;
  if (previous.tracking_notification_sent_at) return false;
  return true;
}

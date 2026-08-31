import { isValidKitSize } from "@/lib/shop/kitUnits";

export const KIT_REQUEST_STATUSES = ["open", "full", "cancelled", "expired", "ordered"] as const;
export type KitRequestStatus = (typeof KIT_REQUEST_STATUSES)[number];

export const KIT_REQUEST_STATUS_LABELS: Record<KitRequestStatus, string> = {
  open: "Offen",
  full: "Vollständig",
  cancelled: "Storniert",
  expired: "Abgelaufen",
  ordered: "Bestellt",
};

export const KIT_REQUEST_SORTS = ["newest", "fewest_remaining", "most_remaining"] as const;
export type KitRequestSort = (typeof KIT_REQUEST_SORTS)[number];

export function kitRequestStatusLabel(status: string): string {
  if (status in KIT_REQUEST_STATUS_LABELS) {
    return KIT_REQUEST_STATUS_LABELS[status as KitRequestStatus];
  }
  return status;
}

export function kitRequestProgressPercent(allocated: number, kitSize: number): number {
  if (!Number.isFinite(allocated) || !Number.isFinite(kitSize) || kitSize <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((allocated / kitSize) * 100)));
}

export function remainingQuantityOptions(remaining: number): number[] {
  if (!Number.isInteger(remaining) || remaining < 1) return [];
  return Array.from({ length: remaining }, (_, i) => i + 1);
}

export function isValidCreatorQuantity(kitSize: number, creatorQuantity: number): boolean {
  return isValidKitSize(kitSize) && Number.isInteger(creatorQuantity) && creatorQuantity >= 1 && creatorQuantity < kitSize;
}

const FORBIDDEN_PRICE_KEYS = /price|markup|einkauf|cost/i;
const ALLOWED_OWN_PRICE_KEYS = new Set(["myPriceUsd", "myUnitPriceUsd"]);

/** Defense-in-depth: marketplace payloads may only contain the viewer's own prices. */
export function assertKitRequestPricePrivacy(payload: unknown): void {
  walkForPrivacy(payload, []);
}

function walkForPrivacy(value: unknown, path: string[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) walkForPrivacy(item, path);
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    const lower = key.toLowerCase();
    if (lower === "email" || lower === "display_name" || lower === "displayname" || lower === "role") {
      throw new Error(`Kit-Gesuch-Antwort enthält unzulässiges Feld: ${key}`);
    }
    if (FORBIDDEN_PRICE_KEYS.test(key) && !ALLOWED_OWN_PRICE_KEYS.has(key)) {
      throw new Error(`Unzulässiges Preisfeld in Kit-Gesuch-Antwort: ${key}`);
    }
    walkForPrivacy(child, [...path, key]);
  }
}

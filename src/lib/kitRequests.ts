import { isValidKitSize } from "@/lib/shop/kitUnits";

export const KIT_REQUEST_STATUSES = ["open", "full", "cancelled", "expired", "ordered"] as const;
export type KitRequestStatus = (typeof KIT_REQUEST_STATUSES)[number];

export const KIT_REQUEST_STATUS_LABELS: Record<KitRequestStatus, string> = {
  open: "Offen",
  full: "Voll",
  cancelled: "Storniert",
  expired: "Abgelaufen",
  ordered: "Bestellt",
};

/** Customer-facing status. "Fast voll" is presentation only — the server status stays open. */
export function kitRequestCustomerStatusLabel(status: string, remainingVials = Number.POSITIVE_INFINITY): string {
  if (status === "open" && remainingVials > 0 && remainingVials <= 2) return "Fast voll";
  return kitRequestStatusLabel(status);
}

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

export function isValidJoinQuantity(remaining: number, quantity: number): boolean {
  return remainingQuantityOptions(remaining).includes(quantity);
}

export const KIT_REQUEST_CARD_GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

export function isValidCreatorQuantity(kitSize: number, creatorQuantity: number): boolean {
  return isValidKitSize(kitSize) && Number.isInteger(creatorQuantity) && creatorQuantity >= 1 && creatorQuantity < kitSize;
}

export const KIT_REQUEST_MUTATION_FAILED_MESSAGE =
  "Das hat leider nicht funktioniert. Dein Kit wurde nicht verändert. Bitte versuche es noch einmal.";

/** Customer toast stays generic. The real RPC/Postgrest detail stays in the console. */
export function kitRequestFailureMessage(error: unknown): string {
  const detail =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  console.error("kit request failed:", error, detail);
  return KIT_REQUEST_MUTATION_FAILED_MESSAGE;
}

/**
 * null = requestable set unknown (legacy RPC missing) → keep current catalog visible.
 * A loaded set hides vendor-only rows that create_kit_request cannot store.
 */
export function isKitRequestableProductId(
  productId: string | null | undefined,
  requestableIds: ReadonlySet<string> | null,
): boolean {
  if (!productId) return false;
  if (requestableIds == null) return true;
  return requestableIds.has(productId);
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

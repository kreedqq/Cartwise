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
  if (status === "cancelled") return "Abgebrochen";
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

/** Free slots excluding the caller's current row (others only). */
export function otherParticipantsQuantity(allocatedTotal: number, ownQuantity: number): number {
  const allocated = Number.isFinite(allocatedTotal) ? allocatedTotal : 0;
  const own = Number.isFinite(ownQuantity) ? Math.max(0, ownQuantity) : 0;
  return Math.max(0, allocated - own);
}

/** Max absolute own quantity for join or update: kit_size - others (own not double-counted). */
export function maxOwnKitQuantity(kitSize: number, allocatedTotal: number, ownQuantity = 0): number {
  if (!Number.isInteger(kitSize) || kitSize < 1) return 0;
  return Math.max(0, kitSize - otherParticipantsQuantity(allocatedTotal, ownQuantity));
}

export function canSetOwnKitQuantity(
  kitSize: number,
  allocatedTotal: number,
  ownCurrentQuantity: number,
  ownNewQuantity: number,
): boolean {
  if (!Number.isInteger(ownNewQuantity) || ownNewQuantity < 1) return false;
  return ownNewQuantity <= maxOwnKitQuantity(kitSize, allocatedTotal, ownCurrentQuantity);
}

/** Quantity buttons for join (own=0) or update (own>0): 1..maxOwn. */
export function ownQuantityOptions(kitSize: number, allocatedTotal: number, ownQuantity = 0): number[] {
  return remainingQuantityOptions(maxOwnKitQuantity(kitSize, allocatedTotal, ownQuantity));
}

export const KIT_REQUEST_CARD_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

export function isValidCreatorQuantity(kitSize: number, creatorQuantity: number): boolean {
  return isValidKitSize(kitSize) && Number.isInteger(creatorQuantity) && creatorQuantity >= 1 && creatorQuantity < kitSize;
}

export const KIT_REQUEST_CREATE_LABEL = "Gesuch erstellen";

export const KIT_REQUEST_ROLE_DENIED_MESSAGE =
  "Kit Gesuche sind für deine aktuelle Rolle nicht freigeschaltet.";

export const KIT_REQUEST_NOT_SHAREABLE_MESSAGE =
  "Dieses Produkt kann nicht als Kit Gesuch geteilt werden.";

export const KIT_REQUEST_TABS_LIST_CLASS =
  "flex h-auto min-h-11 w-full flex-wrap justify-start gap-1 overflow-x-auto rounded-xl bg-secondary/50 p-1";

export const KIT_REQUEST_TAB_TRIGGER_CLASS =
  "min-h-11 shrink-0 rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border";

export const KIT_REQUEST_MUTATION_FAILED_MESSAGE =
  "Das hat leider nicht funktioniert. Dein Kit wurde nicht verändert. Bitte versuche es noch einmal.";

function extractKitRpcError(error: unknown): { message: string; code?: string; details?: string; hint?: string } {
  if (error instanceof Error) {
    const withFields = error as Error & { code?: string; details?: string; hint?: string };
    return {
      message: error.message,
      code: withFields.code,
      details: withFields.details,
      hint: withFields.hint,
    };
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string" && record.message.trim()
        ? record.message
        : typeof record.details === "string" && record.details.trim()
          ? record.details
          : "unknown";
    return {
      message,
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
    };
  }
  return { message: String(error) };
}

/** Customer toast stays generic. The real RPC/Postgrest detail stays in the console. */
export function kitRequestFailureMessage(error: unknown, operation = "kit_request"): string {
  const extracted = extractKitRpcError(error);
  console.error("[peptix:kit]", {
    operation,
    code: extracted.code ?? null,
    message: extracted.message,
    details: extracted.details ?? null,
    hint: extracted.hint ?? null,
  });
  return KIT_REQUEST_MUTATION_FAILED_MESSAGE;
}

/**
 * null = requestable set unknown (legacy RPC missing) → keep current catalog visible.
 * A loaded set is the server allowlist: linked masters and vendor-only sap.id.
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

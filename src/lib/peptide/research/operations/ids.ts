/** Persisted research rows must be real UUIDs — never intake placeholders. */
export const PERSISTED_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.startsWith("intake:")) return false;
  return PERSISTED_UUID.test(id);
}

let seq = 0;
let deterministic = false;

export function nextOperationsUuid(): string {
  if (!deterministic && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

export function resetOperationsUuidSeq(): void {
  seq = 0;
  deterministic = true;
}

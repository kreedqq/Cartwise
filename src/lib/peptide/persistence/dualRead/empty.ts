function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** null / undefined / "" / [] are the same empty value. */
export function emptyEquivalent(a: unknown, b: unknown): boolean {
  return isEmptyValue(a) && isEmptyValue(b);
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function textsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (emptyEquivalent(a, b)) return true;
  return (a ?? "").trim() === (b ?? "").trim();
}

export function textsFormatOnly(a: string | null | undefined, b: string | null | undefined): boolean {
  if (textsEqual(a, b)) return false;
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

export function sortedCopy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].map((item) => item.trim()).sort();
  const right = [...b].map((item) => item.trim()).sort();
  return left.every((item, index) => item === right[index]);
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

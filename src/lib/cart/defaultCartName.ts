const GENERIC_CART_NAME = "Warenkorb";

/**
 * Stable cart title from the current Telegram handle and a frozen ordinal.
 * Ordinal 1 is the bare username; 2+ is "username – Warenkorb N".
 * Never derives a name from email or display_name.
 */
export function cartTitleFromOrdinal(
  username: string | null | undefined,
  ordinal: number,
): string {
  const base = username?.trim();
  const n = Number.isFinite(ordinal) && ordinal >= 1 ? Math.floor(ordinal) : 1;
  if (!base) {
    return n <= 1 ? GENERIC_CART_NAME : `${GENERIC_CART_NAME} – ${GENERIC_CART_NAME} ${n}`;
  }
  if (n <= 1) return base;
  return `${base} – ${GENERIC_CART_NAME} ${n}`;
}

/** Next title if the caller only knows existing names (client preview / tests). */
export function defaultCartName(
  username: string | null | undefined,
  existingNames: readonly string[] = [],
): string {
  const base = username?.trim();
  if (!base) return GENERIC_CART_NAME;

  const taken = new Set(existingNames.map((name) => name.trim()).filter(Boolean));
  if (!taken.has(base)) return cartTitleFromOrdinal(base, 1);

  let index = 2;
  let candidate = cartTitleFromOrdinal(base, index);
  while (taken.has(candidate)) {
    index += 1;
    candidate = cartTitleFromOrdinal(base, index);
  }
  return candidate;
}

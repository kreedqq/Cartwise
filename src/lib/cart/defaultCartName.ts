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
  void ordinal;
  if (!base) return GENERIC_CART_NAME;
  return base;
}

/** Next title if the caller only knows existing names (client preview / tests). */
export function defaultCartName(
  username: string | null | undefined,
  _existingNames: readonly string[] = [],
): string {
  return cartTitleFromOrdinal(username, 1);
}

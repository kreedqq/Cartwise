const GENERIC_CART_NAME = "Warenkorb";

/**
 * Default name for a newly created cart: the account username.
 * A second open cart becomes "username – Warenkorb 2".
 * Never derives a name from email.
 */
export function defaultCartName(
  username: string | null | undefined,
  existingNames: readonly string[] = [],
): string {
  const base = username?.trim();
  if (!base) return GENERIC_CART_NAME;

  const taken = new Set(existingNames.map((name) => name.trim()).filter(Boolean));
  if (!taken.has(base)) return base;

  let index = 2;
  let candidate = `${base} – ${GENERIC_CART_NAME} ${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `${base} – ${GENERIC_CART_NAME} ${index}`;
  }
  return candidate;
}

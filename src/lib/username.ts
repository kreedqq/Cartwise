/** Canonical public handle from `profiles.username`. Never email or display_name. */
export function publicUsername(
  profile: { username?: string | null } | null | undefined,
): string | null {
  const value = profile?.username?.trim();
  return value ? value : null;
}

/** Visible Telegram handle, always with a leading @ when a username exists. */
export function telegramHandleLabel(username: string | null | undefined): string {
  const value = username?.trim();
  if (!value) return "—";
  return value.startsWith("@") ? value : `@${value}`;
}

/** Visible account label for the signed-in user. Never an email prefix. */
export function visibleAccountLabel(
  profile: { username?: string | null } | null | undefined,
  fallback = "Konto",
): string {
  return publicUsername(profile) ?? fallback;
}

export function accountInitials(username: string | null | undefined): string {
  const value = username?.trim();
  if (!value) return "";
  return value.slice(0, 2).toUpperCase();
}

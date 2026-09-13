import { supabase } from "@/lib/supabaseClient";

const CHANGE_ELIGIBLE_PREFIX = "peptix:username-change-eligible:";

export function usernameChangeEligibleKey(userId: string): string {
  return `${CHANGE_ELIGIBLE_PREFIX}${userId}`;
}

/** Mark that this browser session may show the admin-requested Telegram linking gate. */
export function markUsernameChangeEligible(userId: string): void {
  try {
    sessionStorage.setItem(usernameChangeEligibleKey(userId), "1");
  } catch {
    // Private mode / blocked storage: fail closed (no gate without session mark).
  }
}

export function clearUsernameChangeEligible(userId: string): void {
  try {
    sessionStorage.removeItem(usernameChangeEligibleKey(userId));
  } catch {
    // ignore
  }
}

export function isUsernameChangeEligible(userId: string): boolean {
  try {
    return sessionStorage.getItem(usernameChangeEligibleKey(userId)) === "1";
  } catch {
    return false;
  }
}

/** Read-only availability probe. Never reveals who owns a taken username. */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("username_available", { _username: username });
  if (error) throw error;
  return Boolean(data);
}

/** Claims a validated, unique username for the current user (initial claim only). */
export async function claimUsername(username: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_username", { _username: username });
  if (error) throw error;
  return String(data);
}

/**
 * Applies the verified Telegram OIDC preferred_username after admin-requested
 * Telegram identity linking (or fresh Telegram session). Server reads
 * auth.identities only — never client-supplied names.
 */
export async function applyTelegramReauthUsername(): Promise<string> {
  const { data, error } = await supabase.rpc("apply_telegram_reauth_username");
  if (error) throw error;
  return String(data);
}

export function mapUsernameError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/bereits verwendet|bereits vergeben/i.test(raw)) {
    return "Dieser Telegram Benutzername wird bereits verwendet.";
  }
  if (/gesperrt/i.test(raw)) {
    return "Dein Telegram Benutzername ist gesperrt und kann nicht selbst geändert werden.";
  }
  if (/Kein verifizierter Telegram Benutzername/i.test(raw)) {
    return "Kein verifizierter Telegram Benutzername verfügbar. Bitte verwende ein Telegram-Konto mit Benutzername.";
  }
  if (/Bitte melde dich mit Telegram an/i.test(raw)) {
    return "Bitte melde dich mit Telegram an. Dein bestehender PEPTIX Account wird anschließend mit deinem Telegram Konto verknüpft.";
  }
  if (/Keine Telegram Anmeldung angefordert/i.test(raw)) {
    return "Keine Telegram Anmeldung angefordert.";
  }
  if (/Ungültiger (Telegram )?Benutzername/i.test(raw)) {
    return raw.includes("Telegram") ? raw : raw.replace("Benutzername", "Telegram Benutzername");
  }
  return raw || "Der Telegram Benutzername konnte nicht gespeichert werden.";
}

/**
 * Initial missing username → always prompt.
 * Admin Telegram linking → only after a fresh SIGNED_IN in this browser session.
 * Profile stays read-only either way.
 */
export function shouldPromptForUsername(input: {
  loading: boolean;
  user: { id: string } | null;
  profile: { username: string | null; username_required_on_next_login?: boolean } | null;
}): boolean {
  if (input.loading || !input.user || !input.profile) return false;
  const hasUsername = Boolean(input.profile.username?.trim());
  if (!hasUsername) return true;
  if (!input.profile.username_required_on_next_login) return false;
  return isUsernameChangeEligible(input.user.id);
}

/** Admin-requested Telegram identity linking (existing username + flag). */
export function isUsernameChangeRequest(profile: {
  username: string | null;
  username_required_on_next_login?: boolean;
} | null): boolean {
  return Boolean(profile?.username?.trim() && profile.username_required_on_next_login);
}

export const isTelegramReauthRequired = isUsernameChangeRequest;

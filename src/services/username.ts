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

const TRANSFER_INTENT_KEY = "peptix:telegram-transfer-intent";
const TRANSFER_CONFLICT_KEY = "peptix:telegram-identity-conflict";
const TRANSFER_CONFLICT_TTL_MS = 15 * 60 * 1000;

export function markTelegramIdentityConflict(): void {
  try {
    sessionStorage.setItem(TRANSFER_CONFLICT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function clearTelegramIdentityConflict(): void {
  try {
    sessionStorage.removeItem(TRANSFER_CONFLICT_KEY);
  } catch {
    // ignore
  }
}

export function hasTelegramIdentityConflict(): boolean {
  try {
    const raw = sessionStorage.getItem(TRANSFER_CONFLICT_KEY);
    if (!raw) return false;
    const started = Number(raw);
    if (!Number.isFinite(started) || Date.now() - started > TRANSFER_CONFLICT_TTL_MS) {
      sessionStorage.removeItem(TRANSFER_CONFLICT_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function storeTelegramTransferIntent(intentId: string): void {
  try {
    sessionStorage.setItem(TRANSFER_INTENT_KEY, intentId);
  } catch {
    // ignore
  }
}

export function readTelegramTransferIntent(): string | null {
  try {
    return sessionStorage.getItem(TRANSFER_INTENT_KEY);
  } catch {
    return null;
  }
}

export function clearTelegramTransferIntent(): void {
  try {
    sessionStorage.removeItem(TRANSFER_INTENT_KEY);
  } catch {
    // ignore
  }
}

/** Target user confirms the reassignment UI before Telegram ownership proof. */
export async function createTelegramTransferIntent(): Promise<string> {
  const { data, error } = await supabase.rpc("create_telegram_transfer_intent");
  if (error) throw error;
  return String(data);
}

export async function cancelTelegramTransferIntent(intentId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_telegram_transfer_intent", { _intent_id: intentId });
  if (error) throw error;
}

/**
 * Called while signed in as the Telegram identity owner (source account)
 * after a fresh Telegram OIDC login, with a pending intent for the target.
 */
export async function completeTelegramIdentityTransfer(intentId: string): Promise<string> {
  const { data, error } = await supabase.rpc("complete_telegram_identity_transfer", {
    _intent_id: intentId,
  });
  if (error) throw error;
  return String(data);
}

export function isTelegramIdentityConflictError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const msg = raw.toLowerCase();
  return (
    msg.includes("identity_already_exists") ||
    msg.includes("already linked") ||
    msg.includes("identity is already linked") ||
    msg.includes("bereits mit einem anderen peptix")
  );
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
  if (/einzige Anmeldung des bisherigen PEPTIX Kontos/i.test(raw)) {
    return "Dieses Telegram Konto ist die einzige Anmeldung des bisherigen PEPTIX Kontos und kann nicht übertragen werden.";
  }
  if (/Bitte melde dich mit Telegram an/i.test(raw)) {
    return "Bitte melde dich mit Telegram an. Dein bestehender PEPTIX Account wird anschließend mit deinem Telegram Konto verknüpft.";
  }
  if (/Keine Telegram Anmeldung angefordert/i.test(raw)) {
    return "Keine Telegram Anmeldung angefordert.";
  }
  if (/Telegram Identity gehört bereits zu diesem PEPTIX Konto/i.test(raw)) {
    return "Telegram Identity gehört bereits zu diesem PEPTIX Konto.";
  }
  if (/Telegram Identity konnte nicht übertragen werden/i.test(raw)) {
    return "Telegram Identity konnte nicht übertragen werden.";
  }
  if (/Ungültiger (Telegram )?Benutzername/i.test(raw)) {
    return raw.includes("Telegram") ? raw : raw.replace("Benutzername", "Telegram Benutzername");
  }
  if (raw.trim()) return raw;
  return "Der Telegram Benutzername konnte nicht zugewiesen werden.";
}

/**
 * Initial missing username → always prompt (claim form).
 *
 * Admin Telegram linking request (`username_required_on_next_login`):
 * - no custom:telegram yet → prompt Telegram linking gate after fresh login (Fall B)
 * - custom:telegram already present → never prompt; do not call apply on normal login (Fall C)
 *
 * preferred_username must never overwrite profiles.username on normal Telegram login (Fall A).
 */
export function shouldPromptForUsername(input: {
  loading: boolean;
  user: {
    id: string;
    identities?: Array<{ provider?: string | null }> | null;
  } | null;
  profile: { username: string | null; username_required_on_next_login?: boolean } | null;
}): boolean {
  if (input.loading || !input.user || !input.profile) return false;

  const hasUsername = Boolean(input.profile.username?.trim());
  // Fall: initial username claim
  if (!hasUsername) return true;

  const adminTelegramRequest = Boolean(input.profile.username_required_on_next_login);
  if (!adminTelegramRequest) return false;

  const hasTelegram = Boolean(
    input.user.identities?.some((identity) => identity.provider === "custom:telegram"),
  );

  // Fall C / A: Telegram already linked — admin flag must not block login or rewrite username.
  if (hasTelegram) {
    console.info("[peptix:username]", {
      operation: "shouldPromptForUsername",
      reason: "skip_gate_already_has_telegram",
      currentUsername: input.profile.username,
      usernameRequired: true,
      hasTelegram: true,
    });
    return false;
  }

  // Fall B: admin request + no Telegram identity → force linking after fresh login.
  const eligible = isUsernameChangeEligible(input.user.id);
  console.info("[peptix:username]", {
    operation: "shouldPromptForUsername",
    reason: eligible ? "admin_telegram_link_required" : "admin_request_waiting_for_fresh_login",
    currentUsername: input.profile.username,
    usernameRequired: true,
    hasTelegram: false,
    eligible,
  });
  return eligible;
}

/** Admin-requested Telegram identity linking (existing username + flag). */
export function isUsernameChangeRequest(profile: {
  username: string | null;
  username_required_on_next_login?: boolean;
} | null): boolean {
  return Boolean(profile?.username?.trim() && profile.username_required_on_next_login);
}

export const isTelegramReauthRequired = isUsernameChangeRequest;

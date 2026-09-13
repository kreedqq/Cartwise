import { supabase } from "@/lib/supabaseClient";
import { clearTelegramIdentityConflict, clearTelegramTransferIntent } from "@/services/username";

export const DISCORD_OAUTH_PROVIDER = "discord" as const;
export const TELEGRAM_OAUTH_PROVIDER = "custom:telegram" as const;
/** Dashboard Custom OIDC scopes. Space-separated for supabase-js; never include phone. */
export const TELEGRAM_OAUTH_SCOPES = "openid profile";
export const OAUTH_PROVIDERS = [DISCORD_OAUTH_PROVIDER, TELEGRAM_OAUTH_PROVIDER] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_CALLBACK_PATH = "/auth/callback";
export const POST_LOGIN_PATH = "/announcements";
export const OAUTH_SUCCESS_PATH = "/announcements";

const BLOCKED_POST_LOGIN_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/403",
  "/username-required",
  "/consent",
];

/**
 * Honors ProtectedRoute's `location.state.from` when it is an in-app path.
 * External URLs and auth pages fall back to the dashboard.
 */
export function safePostLoginPath(from: unknown): string {
  if (!from || typeof from !== "object") return POST_LOGIN_PATH;
  const loc = from as { pathname?: unknown; search?: unknown };
  if (typeof loc.pathname !== "string") return POST_LOGIN_PATH;
  const pathname = loc.pathname;
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) {
    return POST_LOGIN_PATH;
  }
  if (BLOCKED_POST_LOGIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return POST_LOGIN_PATH;
  }
  const search = typeof loc.search === "string" ? loc.search : "";
  return `${pathname}${search}`;
}

/**
 * Redirect target after email confirmation / password reset / magic link / OAuth.
 * Derived from `window.location.origin` + Vite BASE_URL at runtime so
 * production never uses a baked-in localhost redirect.
 */
export function getRedirectUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  return `${window.location.origin}${base}${path}`;
}

export type OAuthCallbackResult =
  | { status: "authenticated" }
  | { status: "failed"; message: string }
  | { status: "pending" };

type SessionLookup = () => Promise<{
  data: { session: unknown | null };
  error: { message: string } | null;
}>;

const OAUTH_FLOW_LOCK_KEY = "peptix:oauth-flow-lock";
const OAUTH_FLOW_LOCK_MS = 20_000;

/** Prevents double-start of Telegram/Discord OAuth in the same tab. */
export function beginOAuthFlowLock(): boolean {
  try {
    const raw = sessionStorage.getItem(OAUTH_FLOW_LOCK_KEY);
    const started = raw ? Number(raw) : 0;
    if (started && Date.now() - started < OAUTH_FLOW_LOCK_MS) return false;
    sessionStorage.setItem(OAUTH_FLOW_LOCK_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export function clearOAuthFlowLock(): void {
  try {
    sessionStorage.removeItem(OAUTH_FLOW_LOCK_KEY);
  } catch {
    // ignore
  }
}

/** Distinguishes login vs linkIdentity vs transfer OAuth callbacks. */
export type OAuthFlowKind = "login" | "link" | "transfer";

const OAUTH_FLOW_KIND_KEY = "peptix:oauth-flow-kind";

/**
 * Marks the active OAuth flow for AuthCallback.
 * login/link clear stale transfer intents so a normal Telegram login never completes a transfer.
 */
export function beginOAuthFlowKind(kind: OAuthFlowKind): void {
  try {
    sessionStorage.setItem(OAUTH_FLOW_KIND_KEY, kind);
  } catch {
    // ignore
  }
  if (kind === "login") {
    clearTelegramTransferIntent();
    clearTelegramIdentityConflict();
  } else if (kind === "link") {
    clearTelegramTransferIntent();
  }
}

export function readOAuthFlowKind(): OAuthFlowKind | null {
  try {
    const value = sessionStorage.getItem(OAUTH_FLOW_KIND_KEY);
    if (value === "login" || value === "link" || value === "transfer") return value;
    return null;
  } catch {
    return null;
  }
}

export function clearOAuthFlowKind(): void {
  try {
    sessionStorage.removeItem(OAUTH_FLOW_KIND_KEY);
  } catch {
    // ignore
  }
}

export function isIdentityAlreadyLinkedMessage(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("identity_already_exists") ||
    msg.includes("already linked") ||
    msg.includes("identity is already linked")
  );
}

/**
 * Expected follow-on errors when `detectSessionInUrl` already consumed the PKCE code.
 * Real OAuth failures (invalid_code, pkce mismatch/missing, access_denied, …) must NOT match.
 */
export function isRecoverableConsumedOAuthCodeError(message: string): boolean {
  const msg = message.toLowerCase();
  if (isIdentityAlreadyLinkedMessage(msg)) return false;
  if (msg.includes("access_denied") || msg.includes("access denied")) return false;
  if (msg.includes("redirect") && (msg.includes("not allowed") || msg.includes("invalid"))) return false;
  if (msg.includes("invalid_state") || msg.includes("invalid state")) return false;
  if (msg.includes("pkce_verifier_mismatch") || (msg.includes("verifier") && msg.includes("mismatch"))) {
    return false;
  }
  if (msg.includes("pkce_verifier_missing") || (msg.includes("verifier") && msg.includes("missing"))) {
    return false;
  }
  // Verifier already cleared after a successful auto-exchange (supabase-js wording).
  if (
    msg.includes("code verifier") &&
    (msg.includes("non-empty") || msg.includes("should be non-empty") || msg.includes("empty"))
  ) {
    return true;
  }
  if (
    (msg.includes("code") || msg.includes("auth code") || msg.includes("authorization code")) &&
    (msg.includes("already") || msg.includes("exchanged") || msg.includes("reuse") || msg.includes("used"))
  ) {
    return true;
  }
  // Second exchange after detectSessionInUrl often surfaces as invalid/missing flow state.
  if (msg.includes("invalid flow state") || msg.includes("no valid flow state")) return true;
  return false;
}

/**
 * Non-secret OAuth callback diagnostics for production debugging.
 * Never logs code, tokens, verifiers, or cookies.
 */
export function logOAuthCallbackDiagnostics(input: {
  href: string;
  search?: string;
  hash?: string;
  phase: "start" | "result";
  status?: string;
  message?: string;
}): void {
  try {
    const url = new URL(input.href);
    const search = new URLSearchParams((input.search ?? url.search).replace(/^\?/, ""));
    const hash = new URLSearchParams((input.hash ?? url.hash).replace(/^#/, ""));
    const pick = (key: string) => search.get(key) ?? hash.get(key);
    console.info("[peptix:oauth]", {
      phase: input.phase,
      path: url.pathname,
      hasCode: Boolean(pick("code")),
      error: pick("error"),
      error_description: pick("error_description"),
      hasState: Boolean(pick("state")),
      hasFlowId: Boolean(pick("flow_id") ?? pick("sb_flow_id")),
      status: input.status,
      message: input.message ? input.message.slice(0, 180) : undefined,
    });
  } catch {
    console.info("[peptix:oauth]", { phase: input.phase, status: input.status });
  }
}

/**
 * Completes the PKCE callback without racing `detectSessionInUrl`.
 *
 * A failed exchange is authenticated ONLY when a session exists AND the error is a
 * recoverable consumed-code follow-on (detectSessionInUrl already succeeded).
 * Real OAuth errors always fail — even if a prior email/Discord session remains.
 */
export async function completeOAuthCallback(args: {
  href: string;
  search?: string;
  hash?: string;
  getSession: SessionLookup;
  exchangeCodeForSession: (url: string) => Promise<{ error: { message: string } | null }>;
}): Promise<OAuthCallbackResult> {
  const oauthError = readOAuthCallbackError(args.search ?? "", args.hash ?? "");
  if (oauthError) return { status: "failed", message: oauthError };

  const hrefCode = (() => {
    try {
      return new URL(args.href).searchParams.get("code");
    } catch {
      return null;
    }
  })();
  const search = args.search ?? "";
  const searchCode = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("code");
  const code = hrefCode ?? searchCode;

  // Always attempt exchange when a code is present — including linkIdentity returns
  // while an email/Discord session already exists.
  if (code) {
    const before = await args.getSession();
    if (before.error) return { status: "failed", message: before.error.message };

    const { error } = await args.exchangeCodeForSession(args.href);
    const after = await args.getSession();

    if (error && isIdentityAlreadyLinkedMessage(error.message)) {
      return { status: "failed", message: error.message };
    }

    if (!error && after.data.session) {
      return { status: "authenticated" };
    }

    // detectSessionInUrl already exchanged; second call fails with code-already-used.
    if (
      error &&
      after.data.session &&
      isRecoverableConsumedOAuthCodeError(error.message)
    ) {
      return { status: "authenticated" };
    }

    if (error) return { status: "failed", message: error.message };
    if (after.error) return { status: "failed", message: after.error.message };
    return { status: "failed", message: "session missing" };
  }

  const existing = await args.getSession();
  if (existing.error) return { status: "failed", message: existing.error.message };
  if (existing.data.session) return { status: "authenticated" };
  return { status: "pending" };
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  status: number;
  type?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

const OAUTH_PROVIDER_HOSTS = ["discord.com", "discordapp.com", "oauth.telegram.org"] as const;

function messageFromAuthorizeBody(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      url?: string;
      error?: string;
      error_description?: string;
      msg?: string;
      message?: string;
    };
    return (
      parsed.error_description ||
      parsed.msg ||
      parsed.message ||
      parsed.error ||
      raw ||
      "provider is not enabled"
    );
  } catch {
    return raw || "provider is not enabled";
  }
}

/** Only Discord / Telegram identity pages — never GoTrue `/authorize` (that JSON is downloaded as authorize.json). */
export function isSafeOAuthProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return OAUTH_PROVIDER_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function isGoTrueAuthorizeUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/auth/v1/authorize");
  } catch {
    return false;
  }
}

export function isDiscordGoTrueAuthorizeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes("/auth/v1/authorize")) return false;
    return parsed.searchParams.get("provider") === DISCORD_OAUTH_PROVIDER;
  } catch {
    return false;
  }
}

/** GoTrue `/authorize` for the OAuth providers Peptix actually enables. */
export function isEnabledGoTrueOAuthAuthorizeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes("/auth/v1/authorize")) return false;
    const provider = parsed.searchParams.get("provider");
    return provider === DISCORD_OAUTH_PROVIDER || provider === TELEGRAM_OAUTH_PROVIDER;
  } catch {
    return false;
  }
}

/** supabase-js appends this flag; GoTrue ignores it and may forward it to Discord/Telegram. */
export function stripSkipHttpRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("skip_http_redirect")) return url;
    parsed.searchParams.delete("skip_http_redirect");
    // URL() encodes `custom:telegram` as `custom%3Atelegram`; GoTrue needs the literal id.
    return parsed.toString().replaceAll("provider=custom%3Atelegram", `provider=${TELEGRAM_OAUTH_PROVIDER}`);
  } catch {
    return url;
  }
}

/**
 * Telegram's authorization page (`oauth.telegram.org/auth`) returns the body
 * "origin required" unless `origin` is present. GoTrue's custom OIDC redirect
 * omits it. Discord does not use this parameter.
 */
export function withTelegramOriginParam(url: string, origin: string): string {
  if (!origin) return url;
  try {
    const parsed = new URL(url);
    const telegramHost = parsed.hostname === "oauth.telegram.org" || parsed.hostname.endsWith(".oauth.telegram.org");
    const goTrueTelegram =
      parsed.pathname.includes("/auth/v1/authorize") && parsed.searchParams.get("provider") === TELEGRAM_OAUTH_PROVIDER;
    if (!telegramHost && !goTrueTelegram) return url;
    parsed.searchParams.set("origin", origin);
    return parsed.toString().replaceAll("provider=custom%3Atelegram", `provider=${TELEGRAM_OAUTH_PROVIDER}`);
  } catch {
    return url;
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Turn the GoTrue `/authorize` URL into the real Discord identity URL when the
 * Location header is readable. GoTrue does not honor `skip_http_redirect` (it
 * still 302s and forwards the flag to Discord), and browsers hide `Location`
 * unless it is CORS-exposed. A 302 is therefore treated as a safe document
 * navigation: the browser follows it to Discord. A JSON 400 is never assigned
 * to `window.location` (that is what made Chrome download `authorize.json`).
 */
export async function resolveOAuthRedirectUrl(authorizeUrl: string, fetchImpl: FetchLike = fetch): Promise<string> {
  if (isSafeOAuthProviderUrl(authorizeUrl)) return authorizeUrl;
  if (!isGoTrueAuthorizeUrl(authorizeUrl) && !authorizeUrl.includes("supabase")) {
    throw new Error("oauth_redirect_invalid");
  }

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(authorizeUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      },
    });
  } catch {
    // CORS/network: enabled providers 302 to their identity host.
    // Document navigation follows that redirect. JSON 400 is not this path.
    if (isEnabledGoTrueOAuthAuthorizeUrl(authorizeUrl)) return stripSkipHttpRedirect(authorizeUrl);
    throw new Error("oauth_network");
  }

  const location = response.headers.get("location") ?? response.headers.get("Location");
  if (location && isSafeOAuthProviderUrl(location)) return location;

  const opaqueRedirect = response.status === 0 || response.type === "opaqueredirect";
  if ((isRedirectStatus(response.status) || opaqueRedirect) && isEnabledGoTrueOAuthAuthorizeUrl(authorizeUrl)) {
    return stripSkipHttpRedirect(authorizeUrl);
  }

  const raw = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(raw) as { url?: string };
    if (parsed.url && isSafeOAuthProviderUrl(parsed.url)) return parsed.url;
  } catch {
    // not JSON — fall through
  }

  throw new Error(messageFromAuthorizeBody(raw));
}

/** @deprecated use resolveOAuthRedirectUrl — kept so existing tests keep a stable name. */
export async function inspectOAuthAuthorizeUrl(url: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await resolveOAuthRedirectUrl(url, fetchImpl);
}

export function beginOAuthRedirect(url: string): void {
  if (isSafeOAuthProviderUrl(url)) {
    window.location.assign(url);
    return;
  }
  if (isEnabledGoTrueOAuthAuthorizeUrl(url)) {
    window.location.assign(stripSkipHttpRedirect(url));
    return;
  }
  throw new Error("oauth_redirect_invalid");
}

export function readOAuthCallbackError(
  search: string = typeof window !== "undefined" ? window.location.search : "",
  hash: string = typeof window !== "undefined" ? window.location.hash : "",
): string | null {
  const params = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  return (
    params.get("error_description") ||
    params.get("error") ||
    hashParams.get("error_description") ||
    hashParams.get("error")
  );
}

/**
 * Discord / Telegram sign-in via Supabase Auth.
 * New users are created by Auth; `handle_new_user` assigns role `user` and
 * customer role Kunde server-side. This helper never sends a role, never
 * merges accounts by username/email, and never requires an email for Telegram.
 *
 * `skipBrowserRedirect` is required so a JSON error body is never assigned to
 * `window.location` (Chrome then downloads it as `authorize.json`).
 *
 * Default flow is `login` (Flow A). Pass `{ flow: "transfer" }` only after an
 * explicit transfer confirmation (Flow C).
 */
export async function signInWithOAuth(
  provider: OAuthProvider,
  fetchImpl?: FetchLike,
  options?: { flow?: OAuthFlowKind },
) {
  if (!beginOAuthFlowLock()) {
    throw new Error("oauth_flow_in_progress");
  }
  const flow = options?.flow ?? "login";
  beginOAuthFlowKind(flow);
  const origin = window.location.origin;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      // `custom:telegram` is a dashboard Custom OIDC id; supabase-js Provider is built-ins only.
      provider: provider as "discord",
      options: {
        redirectTo: getRedirectUrl(OAUTH_CALLBACK_PATH),
        skipBrowserRedirect: true,
        ...(provider === TELEGRAM_OAUTH_PROVIDER
          ? { scopes: TELEGRAM_OAUTH_SCOPES, queryParams: { origin } }
          : {}),
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error("provider is not enabled");
    console.info("[peptix:oauth]", {
      phase: "start",
      provider,
      flow,
      redirectTo: getRedirectUrl(OAUTH_CALLBACK_PATH),
      authorizeHost: (() => {
        try {
          return new URL(data.url).hostname;
        } catch {
          return null;
        }
      })(),
      authorizePath: (() => {
        try {
          return new URL(data.url).pathname;
        } catch {
          return null;
        }
      })(),
      pkce: true,
      skipBrowserRedirect: true,
    });
    const resolved = await resolveOAuthRedirectUrl(data.url, fetchImpl);
    const providerUrl = provider === TELEGRAM_OAUTH_PROVIDER ? withTelegramOriginParam(resolved, origin) : resolved;
    beginOAuthRedirect(providerUrl);
    return data;
  } catch (error) {
    clearOAuthFlowLock();
    clearOAuthFlowKind();
    throw error;
  }
}

/** True when the Auth user already has a linked `custom:telegram` identity. */
export function userHasTelegramIdentity(
  user: { identities?: Array<{ provider?: string | null }> | null } | null | undefined,
): boolean {
  return Boolean(user?.identities?.some((identity) => identity.provider === TELEGRAM_OAUTH_PROVIDER));
}

/**
 * Links Telegram OIDC to the **current** signed-in PEPTIX user (manual linking).
 * Does not sign out and must not create a second auth.users row.
 * Requires Dashboard → Auth → Enable Manual Linking.
 */
export async function linkTelegramIdentity(fetchImpl?: FetchLike) {
  if (!beginOAuthFlowLock()) {
    throw new Error("oauth_flow_in_progress");
  }
  beginOAuthFlowKind("link");
  const origin = window.location.origin;
  try {
    const { data, error } = await supabase.auth.linkIdentity({
      // `custom:telegram` is a dashboard Custom OIDC id; supabase-js Provider is built-ins only.
      provider: TELEGRAM_OAUTH_PROVIDER as "discord",
      options: {
        redirectTo: getRedirectUrl(OAUTH_CALLBACK_PATH),
        skipBrowserRedirect: true,
        scopes: TELEGRAM_OAUTH_SCOPES,
        queryParams: { origin },
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error("provider is not enabled");
    console.info("[peptix:oauth]", {
      phase: "start",
      provider: TELEGRAM_OAUTH_PROVIDER,
      flow: "link",
      mode: "linkIdentity",
      redirectTo: getRedirectUrl(OAUTH_CALLBACK_PATH),
      authorizeHost: (() => {
        try {
          return new URL(data.url).hostname;
        } catch {
          return null;
        }
      })(),
      pkce: true,
    });
    const resolved = await resolveOAuthRedirectUrl(data.url, fetchImpl);
    beginOAuthRedirect(withTelegramOriginParam(resolved, origin));
    return data;
  } catch (error) {
    clearOAuthFlowLock();
    clearOAuthFlowKind();
    throw error;
  }
}

/**
 * Admin-requested Telegram step while signed in (Flow B):
 * - no Telegram identity yet → linkIdentity (same auth.users.id)
 * - already linked → fresh Telegram OAuth for that same identity (still Flow B, not transfer)
 * Never signs out first (that would allow a duplicate account on plain signInWithOAuth).
 */
export async function startTelegramAccountLink(user: {
  identities?: Array<{ provider?: string | null }> | null;
} | null, fetchImpl?: FetchLike) {
  if (userHasTelegramIdentity(user)) {
    return signInWithOAuth(TELEGRAM_OAUTH_PROVIDER, fetchImpl, { flow: "link" });
  }
  return linkTelegramIdentity(fetchImpl);
}

export function mapAuthError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
    return "E-Mail oder Passwort ist falsch.";
  }
  if (msg.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  }
  if (msg.includes("user already registered")) {
    return "Diese E-Mail-Adresse ist bereits registriert.";
  }
  if (
    msg.includes("access_denied") ||
    msg.includes("access denied") ||
    msg.includes("user_cancelled") ||
    msg.includes("user cancelled") ||
    msg.includes("abgebrochen") ||
    msg.includes("popup_closed")
  ) {
    return "Anmeldung abgebrochen. Du kannst es erneut versuchen.";
  }
  if (msg.includes("oauth_flow_in_progress")) {
    return "Die Anmeldung läuft bereits. Bitte warte einen Moment.";
  }
  if (msg.includes("manual linking") || msg.includes("linking is disabled") || msg.includes("manual_linking")) {
    return "Telegram-Verknüpfung ist serverseitig nicht aktiviert. Bitte kontaktiere den Support.";
  }
  if (isIdentityAlreadyLinkedMessage(msg)) {
    return "Dieses Telegram Konto ist bereits mit einem anderen PEPTIX Konto verknüpft.";
  }
  if (msg.includes("code") && (msg.includes("already") || msg.includes("exchanged") || msg.includes("reuse"))) {
    return "Die Anmeldung konnte nicht abgeschlossen werden. Bitte starte den Vorgang erneut.";
  }
  if (msg.includes("pkce") || msg.includes("code verifier") || msg.includes("verifier")) {
    return "Die Anmeldung konnte nicht abgeschlossen werden (Sicherheitsprüfung). Bitte starte den Vorgang erneut.";
  }
  if (msg.includes("redirect") && (msg.includes("not allowed") || msg.includes("invalid"))) {
    return "Die Weiterleitungs-URL ist nicht erlaubt. Bitte versuche es erneut oder nutze E-Mail und Passwort.";
  }
  if (msg.includes("oauth_network")) {
    return "Die Verbindung zu Discord ist fehlgeschlagen. Bitte versuche es erneut oder nutze E-Mail und Passwort.";
  }
  if (msg.includes("oauth_redirect_invalid")) {
    return "Die Discord-Weiterleitung wurde blockiert. Bitte versuche es erneut oder nutze E-Mail und Passwort.";
  }
  if (msg.includes("provider is not enabled") || msg.includes("unsupported provider") || msg.includes("validation_failed")) {
    return "Discord hat die Anmeldung abgelehnt. Bitte versuche es erneut oder nutze E-Mail und Passwort.";
  }
  if (msg.includes("oauth") || msg.includes("provider") || msg.includes("unable to exchange")) {
    return "Die Anmeldung über den Anbieter ist fehlgeschlagen. Bitte versuche es erneut oder nutze E-Mail und Passwort.";
  }
  if (msg.includes("invalid") && (msg.includes("callback") || msg.includes("code") || msg.includes("state"))) {
    return "Die Anmeldung konnte nicht abgeschlossen werden. Bitte starte den Vorgang erneut.";
  }
  if (msg.includes("session missing")) {
    return "Die Anmeldung konnte nicht abgeschlossen werden. Bitte starte den Vorgang erneut.";
  }
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Zu viele Versuche. Bitte warte einen Moment.";
  }
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}

export async function signUp(email: string, password: string, displayName: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // `username` is only ever consumed client-side right after signUp (or on
    // first login) via `set_username` — the DB trigger never trusts this
    // metadata for the authoritative, unique username.
    options: {
      data: { display_name: displayName, username },
      emailRedirectTo: getRedirectUrl("/login"),
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.session) return data;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    throw new Error("session missing");
  }
  return { user: sessionData.session.user, session: sessionData.session };
}

export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: getRedirectUrl("/dashboard") },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRedirectUrl("/reset-password"),
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

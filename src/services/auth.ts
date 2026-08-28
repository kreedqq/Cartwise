import { supabase } from "@/lib/supabaseClient";

export const OAUTH_PROVIDERS = ["discord"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_CALLBACK_PATH = "/auth/callback";
export const POST_LOGIN_PATH = "/dashboard";
export const OAUTH_SUCCESS_PATH = "/shop";

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

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  status: number;
  type?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

const OAUTH_PROVIDER_HOSTS = ["discord.com", "discordapp.com"] as const;

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

/** Only Discord identity pages — never GoTrue `/authorize` (that JSON is downloaded as authorize.json). */
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
    return parsed.searchParams.get("provider") === "discord";
  } catch {
    return false;
  }
}

/** supabase-js appends this flag; GoTrue ignores it and may forward it to Discord. */
export function stripSkipHttpRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("skip_http_redirect");
    return parsed.toString();
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
    // CORS/network: Discord is enabled server-side and GoTrue 302s to discord.com.
    // Document navigation follows that redirect. JSON 400 is not this path.
    if (isDiscordGoTrueAuthorizeUrl(authorizeUrl)) return stripSkipHttpRedirect(authorizeUrl);
    throw new Error("oauth_network");
  }

  const location = response.headers.get("location") ?? response.headers.get("Location");
  if (location && isSafeOAuthProviderUrl(location)) return location;

  const opaqueRedirect = response.status === 0 || response.type === "opaqueredirect";
  if ((isRedirectStatus(response.status) || opaqueRedirect) && isDiscordGoTrueAuthorizeUrl(authorizeUrl)) {
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
  if (isDiscordGoTrueAuthorizeUrl(url)) {
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
 * Discord sign-in via Supabase Auth.
 * New users are created by Auth; `handle_new_user` assigns role `user` and
 * customer role Kunde server-side. This helper never sends a role.
 *
 * `skipBrowserRedirect` is required so a JSON error body is never assigned to
 * `window.location` (Chrome then downloads it as `authorize.json`).
 */
export async function signInWithOAuth(provider: OAuthProvider, fetchImpl?: FetchLike) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getRedirectUrl(OAUTH_CALLBACK_PATH),
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("provider is not enabled");
  const providerUrl = await resolveOAuthRedirectUrl(data.url, fetchImpl);
  beginOAuthRedirect(providerUrl);
  return data;
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
  if (msg.includes("identity_already_exists") || msg.includes("already linked")) {
    return "Dieses Konto ist bereits mit einer anderen Anmeldung verknüpft. Bitte mit der ursprünglichen Methode anmelden.";
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
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Zu viele Versuche. Bitte warte einen Moment.";
  }
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: getRedirectUrl("/login"),
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
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

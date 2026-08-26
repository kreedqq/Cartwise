/**
 * Validates the two public Supabase environment variables *before* any request
 * is made.
 *
 * Why this exists: a malformed value used to survive all the way into
 * @supabase/supabase-js, which happily concatenates it with "/auth/v1/token".
 * The browser then reported a network-level failure (ERR_NAME_NOT_RESOLVED, or
 * a 404 against the app's own origin) for a URL that looked almost right,
 * which is close to undebuggable from the outside. A real incident was caused
 * by pasting a Markdown link
 *
 *   [https://ref.supabase.co](https://ref.supabase.co)
 *
 * into the deployment's env var instead of the bare URL. A plain substring
 * search for the project ref still "found" the URL in the bundle, so the
 * misconfiguration looked fine on inspection.
 *
 * The checks below therefore reject anything that is not a bare origin, and
 * name the concrete copy/paste artefact so the fix is obvious. Nothing is
 * silently repaired - a wrong value must fail loudly, not be guessed at.
 */

/** API path prefixes that indicate a full endpoint was pasted, not the project URL. */
const API_PATH_PREFIXES = ["/auth", "/rest", "/realtime", "/storage", "/functions"];

export interface SupabaseConfigOk {
  ok: true;
  url: string;
  anonKey: string;
}

export interface SupabaseConfigError {
  ok: false;
  /** One human-readable problem per invalid value, in German (user-facing). */
  problems: string[];
}

export type SupabaseConfigResult = SupabaseConfigOk | SupabaseConfigError;

/** Copy/paste artefacts that are worth naming explicitly. */
function describeShapeProblem(varName: string, raw: string): string | null {
  if (/^\[.*]\(.*\)$/s.test(raw)) {
    return `${varName} ist ein Markdown-Link "[URL](URL)" statt einer URL. Bitte nur den nackten Wert eintragen.`;
  }
  if (/^["'].*["']$/s.test(raw)) {
    return `${varName} ist von Anführungszeichen umgeben. Bitte den Wert ohne Anführungszeichen eintragen.`;
  }
  if (/\s/.test(raw)) {
    return `${varName} enthält Leerzeichen oder Zeilenumbrüche. Bitte den Wert ohne Umbrüche eintragen.`;
  }
  return null;
}

function checkUrl(raw: string | undefined): string[] {
  const name = "VITE_SUPABASE_URL";
  const value = (raw ?? "").trim();

  if (value === "") {
    return [`${name} ist nicht gesetzt.`];
  }

  const shapeProblem = describeShapeProblem(name, value);
  if (shapeProblem) return [shapeProblem];

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return [`${name} ist keine gültige absolute URL (erwartet: https://<projekt-ref>.supabase.co).`];
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return [`${name} muss mit https:// beginnen (gefunden: ${parsed.protocol}).`];
  }
  if (parsed.search !== "" || parsed.hash !== "") {
    return [`${name} darf keine Query-Parameter oder Anker enthalten.`];
  }
  // A pasted endpoint (".../auth/v1") is a mistake worth catching; an unusual
  // sub-path on a self-hosted instance is not, so only API paths are rejected.
  const path = parsed.pathname.replace(/\/$/, "");
  if (path !== "" && API_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return [`${name} zeigt auf einen API-Endpunkt ("${path}"). Erwartet wird nur die Projekt-URL.`];
  }

  return [];
}

function checkAnonKey(raw: string | undefined): string[] {
  const name = "VITE_SUPABASE_ANON_KEY";
  const value = (raw ?? "").trim();

  if (value === "") {
    return [`${name} ist nicht gesetzt.`];
  }

  const shapeProblem = describeShapeProblem(name, value);
  if (shapeProblem) return [shapeProblem];

  // Accepts both key formats Supabase issues: the current publishable key and
  // the legacy anon JWT. A service-role key is rejected outright - it bypasses
  // RLS and must never reach the browser.
  if (value.startsWith("sb_secret_") || jwtRole(value) === "service_role") {
    return [`${name} ist ein Service-Role-Key. Dieser darf niemals im Browser verwendet werden.`];
  }

  return [];
}

/**
 * The "role" claim of a legacy Supabase JWT, or null if the value is not a
 * readable JWT. Only used to catch a service-role key being pasted into the
 * browser config - never for authorization decisions, which happen in Postgres.
 */
function jwtRole(value: string): string | null {
  const segments = value.split(".");
  if (segments.length !== 3) return null;

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    if (typeof payload === "object" && payload !== null && "role" in payload) {
      const role = (payload as { role: unknown }).role;
      return typeof role === "string" ? role : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads and validates the Supabase config. Returns every problem at once so a
 * misconfigured deployment can be fixed in a single pass.
 */
export function readSupabaseConfig(env: {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}): SupabaseConfigResult {
  const problems = [...checkUrl(env.VITE_SUPABASE_URL), ...checkAnonKey(env.VITE_SUPABASE_ANON_KEY)];
  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    // Trailing slashes are harmless but would produce "//auth/v1" downstream.
    url: (env.VITE_SUPABASE_URL as string).trim().replace(/\/$/, ""),
    anonKey: (env.VITE_SUPABASE_ANON_KEY as string).trim(),
  };
}

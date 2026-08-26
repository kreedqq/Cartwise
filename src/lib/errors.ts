/**
 * Central error mapping: turns Supabase/Postgrest/network errors into safe,
 * helpful German messages. Never surface raw error.message from the
 * backend to the UI (see docs/SECURITY.md - "keine sensiblen Fehlerdetails").
 * Full technical details are only logged to the console (dev) for debugging.
 */

export interface AppError {
  message: string;
  code?: string;
  retryable: boolean;
}

const KNOWN_POSTGRES_CODES: Record<string, string> = {
  "23505": "Dieser Eintrag existiert bereits (Duplikat).",
  "23503": "Der referenzierte Datensatz existiert nicht mehr.",
  "23502": "Ein Pflichtfeld fehlt.",
  "23514": "Die eingegebenen Werte erfüllen nicht alle Anforderungen.",
  PGRST116: "Der angeforderte Datensatz wurde nicht gefunden oder du hast keine Berechtigung dafür.",
  "42501": "Du hast keine Berechtigung für diese Aktion.",
};

export function toAppError(error: unknown): AppError {
  if (error && typeof error === "object") {
    const err = error as { message?: string; code?: string; status?: number };

    if (!isOnline()) {
      return {
        message: "Keine Internetverbindung. Änderungen werden gespeichert, sobald du wieder online bist.",
        retryable: true,
      };
    }

    if (err.code === "PGRST301" || err.status === 401 || err.status === 403) {
      return {
        message: "Deine Sitzung ist abgelaufen oder du hast keine Berechtigung. Bitte melde dich erneut an.",
        code: err.code,
        retryable: false,
      };
    }

    if (err.code && KNOWN_POSTGRES_CODES[err.code]) {
      return { message: KNOWN_POSTGRES_CODES[err.code], code: err.code, retryable: false };
    }

    if (err.message?.toLowerCase().includes("failed to fetch") || err.message?.toLowerCase().includes("network")) {
      return {
        message: "Verbindung zum Server fehlgeschlagen. Bitte prüfe deine Internetverbindung und versuche es erneut.",
        retryable: true,
      };
    }
  }

  if (import.meta.env.DEV) {
    console.error("Unhandled error:", error);
  }

  return {
    message: "Etwas ist schiefgelaufen. Bitte versuche es erneut oder lade die Seite neu.",
    retryable: true,
  };
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export class ConcurrencyError extends Error {
  constructor(message = "Diese Position wurde zwischenzeitlich von jemand anderem geändert.") {
    super(message);
    this.name = "ConcurrencyError";
  }
}

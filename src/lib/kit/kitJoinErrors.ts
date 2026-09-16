/** Customer-facing kit join/update errors. Server message stays in console via kitRequests. */

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

export function kitJoinUserMessage(error: unknown, fallback: string): string {
  const raw = messageFromError(error).toLowerCase();
  if (!raw) return fallback;

  if (raw.includes("nicht genüg") || raw.includes("verfügbar") || raw.includes("remaining")) {
    return "Der gewünschte Anteil ist inzwischen nicht mehr verfügbar.";
  }
  if (raw.includes("vollständig") || raw.includes("voll") || raw.includes("full")) {
    return "Das Kit ist inzwischen vollständig.";
  }
  if (raw.includes("storniert") || raw.includes("cancelled") || raw.includes("beendet")) {
    return "Das Kit wurde beendet.";
  }
  if (raw.includes("abgelaufen") || raw.includes("expired")) {
    return "Das Kit ist abgelaufen.";
  }
  if (raw.includes("duplicate") || raw.includes("bereits")) {
    return "Du nimmst an diesem Kit bereits teil.";
  }
  if (raw.includes("rollen") || raw.includes("freigeschaltet")) {
    return "Kit Gesuche sind für deine Rolle nicht freigeschaltet.";
  }
  return fallback;
}

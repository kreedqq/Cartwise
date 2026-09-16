export type SystemHealthLevel = "healthy" | "needs_attention" | "error";

export function aggregateHealthLevel(levels: SystemHealthLevel[]): SystemHealthLevel {
  if (levels.some((l) => l === "error")) return "error";
  if (levels.some((l) => l === "needs_attention")) return "needs_attention";
  return "healthy";
}

export function healthFromCounts(input: {
  errors?: number;
  warnings?: number;
}): SystemHealthLevel {
  if ((input.errors ?? 0) > 0) return "error";
  if ((input.warnings ?? 0) > 0) return "needs_attention";
  return "healthy";
}

export function healthLabel(level: SystemHealthLevel): string {
  switch (level) {
    case "healthy":
      return "OK";
    case "needs_attention":
      return "Aufmerksamkeit";
    case "error":
      return "Fehler";
  }
}

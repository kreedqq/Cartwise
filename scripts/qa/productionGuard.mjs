/**
 * Hard abort when QA would touch production (Node scripts).
 * Keep in sync with src/lib/qa/productionGuard.ts
 */

export const PRODUCTION_QA_FORBIDDEN_MARKERS = [
  "cnjrjinvxycdkrmzcime",
  "cartwise-prod",
  "peptix.app",
  "https://peptix.app",
];

export function isLocalSupabaseUrl(url) {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

export function findProductionQaMarker(value) {
  if (!value) return null;
  const lower = value.toLowerCase();
  for (const marker of PRODUCTION_QA_FORBIDDEN_MARKERS) {
    if (lower.includes(marker.toLowerCase())) return marker;
  }
  return null;
}

export function assertSafeLocalQaTarget(input) {
  const candidates = [input.supabaseUrl, input.databaseUrl, ...(input.extra ?? [])];
  for (const value of candidates) {
    const hit = findProductionQaMarker(value);
    if (hit) {
      throw new Error(
        `QA TEST ABORT: environment points at production (${hit}). Local QA must use localhost/127.0.0.1 only.`,
      );
    }
  }

  const url = input.supabaseUrl?.trim() ?? "";
  if (!isLocalSupabaseUrl(url)) {
    throw new Error(
      `QA TEST ABORT: VITE_SUPABASE_URL / SUPABASE_URL must be http://127.0.0.1 or http://localhost (got: ${url || "(empty)"}).`,
    );
  }
}

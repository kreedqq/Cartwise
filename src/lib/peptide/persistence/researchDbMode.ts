export type ResearchDbMode = "legacy" | "postgres";

/**
 * Dual-read flag for later lexicon switch. Phase 1 must remain `legacy`:
 * lexicon still reads catalog.ts + published.json.
 */
export function researchDbMode(env: { VITE_RESEARCH_DB_MODE?: string } = import.meta.env): ResearchDbMode {
  const raw = (env.VITE_RESEARCH_DB_MODE ?? "legacy").trim().toLowerCase();
  return raw === "postgres" ? "postgres" : "legacy";
}

export function lexiconUsesPostgresIdentity(env?: { VITE_RESEARCH_DB_MODE?: string }): boolean {
  return researchDbMode(env) === "postgres";
}

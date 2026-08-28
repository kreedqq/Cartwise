export type ResearchDbMode = "legacy" | "dual" | "postgres";

export type ResearchEnv = { VITE_RESEARCH_DB_MODE?: string };

/**
 * Dual-read flag. Production default is `legacy`.
 * `dual` loads Postgres only to compare; the lexicon UI still renders files.
 * `postgres` prepares a DB read layer but Phase 7 does not switch the lexicon.
 */
export function researchDbMode(env: ResearchEnv = import.meta.env): ResearchDbMode {
  const raw = (env.VITE_RESEARCH_DB_MODE ?? "legacy").trim().toLowerCase();
  if (raw === "postgres") return "postgres";
  if (raw === "dual") return "dual";
  return "legacy";
}

/** True only when the lexicon is allowed to *display* Postgres identity. Phase 7: never used by lexicon pages. */
export function lexiconUsesPostgresIdentity(env?: ResearchEnv): boolean {
  return researchDbMode(env) === "postgres";
}

/** Prepared dual-read helper. Phase 7 lexicon still reads published.json. */
export function lexiconUsesPostgresScience(env?: ResearchEnv): boolean {
  return researchDbMode(env) === "postgres";
}

/** Prepared dual-read helper. Phase 7 lexicon still reads published.json regulatory overlays. */
export function lexiconUsesPostgresRegulatory(env?: ResearchEnv): boolean {
  return researchDbMode(env) === "postgres";
}

/** Fetch Postgres in the background for comparison (dual) or the unused prepared read path. */
export function shouldFetchPostgresResearch(env?: ResearchEnv): boolean {
  const mode = researchDbMode(env);
  return mode === "dual" || mode === "postgres";
}

/** Compare normalized legacy vs Postgres snapshots. */
export function shouldCompareResearchReads(env?: ResearchEnv): boolean {
  return shouldFetchPostgresResearch(env);
}

/** Phase 7: lexicon pages always render catalog.ts + published.json. */
export function lexiconDisplaySource(): "legacy" {
  return "legacy";
}

export type ResearchDbMode = "legacy" | "dual" | "postgres";

export type ResearchEnv = { VITE_RESEARCH_DB_MODE?: string };

export type LexiconDisplaySource = "legacy" | "postgres";

/**
 * Public lexicon read mode.
 * Production default is `postgres` (Phase 11) with exclusive legacy fallback.
 * `legacy` is the emergency rollback (`VITE_RESEARCH_DB_MODE=legacy`) — files only.
 * `dual` reads legacy + Postgres for admin comparison only. Public UI never mixes
 * fields from both sources: it uses exclusive Postgres, or exclusive file fallback.
 */
export function researchDbMode(env: ResearchEnv = import.meta.env): ResearchDbMode {
  const raw = (env.VITE_RESEARCH_DB_MODE ?? "postgres").trim().toLowerCase();
  if (raw === "legacy") return "legacy";
  if (raw === "dual") return "dual";
  return "postgres";
}

/** Public lexicon may display Postgres identity when mode is not emergency-legacy. */
export function lexiconUsesPostgresIdentity(env?: ResearchEnv): boolean {
  return researchDbMode(env) !== "legacy";
}

export function lexiconUsesPostgresScience(env?: ResearchEnv): boolean {
  return researchDbMode(env) !== "legacy";
}

export function lexiconUsesPostgresRegulatory(env?: ResearchEnv): boolean {
  return researchDbMode(env) !== "legacy";
}

/** Fetch Postgres in the background for comparison (dual) or the public read path. */
export function shouldFetchPostgresResearch(env?: ResearchEnv): boolean {
  const mode = researchDbMode(env);
  return mode === "dual" || mode === "postgres";
}

/** Compare normalized legacy vs Postgres snapshots (admin dual-read). */
export function shouldCompareResearchReads(env?: ResearchEnv): boolean {
  return shouldFetchPostgresResearch(env);
}

/** Public UI never merges catalog.ts/published.json fields with Postgres on one request. */
export function publicLexiconMixesReads(): false {
  return false;
}

/** Intended public lexicon display source. Actual request source may fall back to legacy. */
export function lexiconDisplaySource(env?: ResearchEnv): LexiconDisplaySource {
  return lexiconUsesPostgresIdentity(env) ? "postgres" : "legacy";
}

export { researchSourceKey } from "@/lib/peptide/persistence/dualRead/keys";
export { postgresBundleFromSeeds, type PostgresResearchBundle } from "@/lib/peptide/persistence/dualRead/bundle";
export { normalizeLegacyResearch } from "@/lib/peptide/persistence/dualRead/normalizeLegacy";
export { normalizePostgresResearch } from "@/lib/peptide/persistence/dualRead/normalizePostgres";
export { compareResearchSnapshots, SEARCH_QUERIES, INTEGRATION_SLUGS } from "@/lib/peptide/persistence/dualRead/compare";
export {
  fetchPostgresResearch,
  mockSelectClient,
  failingSelectClient,
  type ResearchSelectClient,
} from "@/lib/peptide/persistence/dualRead/fetchPostgres";
export { runDualRead, legacyOnlyReport } from "@/lib/peptide/persistence/dualRead/runDualRead";
export { logDualReadReport } from "@/lib/peptide/persistence/dualRead/log";
export type {
  DualReadReport,
  DualReadDifference,
  DualReadVerdict,
  NormalizedResearchSnapshot,
} from "@/lib/peptide/persistence/dualRead/types";

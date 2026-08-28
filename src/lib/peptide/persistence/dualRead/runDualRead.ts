import { compareResearchSnapshots } from "@/lib/peptide/persistence/dualRead/compare";
import type { ResearchSelectClient } from "@/lib/peptide/persistence/dualRead/fetchPostgres";
import { fetchPostgresResearch } from "@/lib/peptide/persistence/dualRead/fetchPostgres";
import { normalizeLegacyResearch } from "@/lib/peptide/persistence/dualRead/normalizeLegacy";
import { normalizePostgresResearch } from "@/lib/peptide/persistence/dualRead/normalizePostgres";
import { researchDbMode, type ResearchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import type { DualReadReport } from "@/lib/peptide/persistence/dualRead/types";

export function legacyOnlyReport(mode: ResearchDbMode = "legacy"): DualReadReport {
  const legacy = normalizeLegacyResearch();
  return {
    mode,
    displaySource: "legacy",
    fallback: null,
    fallbackMessage: null,
    differences: [],
    counts: {
      MATCH: 0,
      ORDER_ONLY: 0,
      FORMAT_ONLY: 0,
      MISSING: 0,
      EXTRA: 0,
      DIFFERENT: 0,
      UNRESOLVED: 0,
    },
    criticalCount: 0,
    verdict: "DUAL_READ_READY",
    totals: {
      substances: legacy.identities.length,
      aliases: legacy.identities.reduce((sum, row) => sum + row.aliases.length + row.developmentNames.length, 0),
      sourceAttachments: legacy.sourceAttachments.length,
      uniqueSources: legacy.sources.length,
      studyAttachments: legacy.studyAttachments.length,
      uniqueStudies: legacy.studies.length,
      claims: legacy.claims.length,
      evidence: legacy.evidence.length,
      overlayEvidence: legacy.evidence.filter((row) => row.overlay).length,
      reviewRequiredEvidence: legacy.evidence.filter((row) => row.reviewStatus === "review-required").length,
      regulatory: legacy.regulatory.length,
      reviewActions: legacy.reviewActions.length,
      communityReports: 0,
    },
  };
}

export async function runDualRead(options: {
  client: ResearchSelectClient;
  mode?: ResearchDbMode;
  timeoutMs?: number;
}): Promise<DualReadReport> {
  const mode = options.mode ?? researchDbMode();
  const legacy = normalizeLegacyResearch();
  if (mode === "legacy") return legacyOnlyReport(mode);

  const fetched = await fetchPostgresResearch(options.client, { timeoutMs: options.timeoutMs });
  if (!fetched.ok) {
    const report = legacyOnlyReport(mode);
    return {
      ...report,
      fallback: fetched.kind,
      fallbackMessage: fetched.message,
      verdict: "DUAL_READ_NOT_READY",
    };
  }

  const postgres = normalizePostgresResearch(fetched.bundle);
  return compareResearchSnapshots(legacy, postgres, { mode, fallback: null });
}

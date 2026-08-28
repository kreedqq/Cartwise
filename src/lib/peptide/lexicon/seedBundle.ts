import { postgresBundleFromSeeds } from "@/lib/peptide/persistence/dualRead/bundle";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import type { PublicLexiconBundle } from "@/lib/peptide/lexicon/types";

/** Seed-shaped public bundle (no review_actions). */
export function publicBundleFromSeeds(): PublicLexiconBundle {
  const full = postgresBundleFromSeeds();
  const claims = publishedClaimsSeed();
  const regulatory = publishedRegulatorySeed();
  const safetyByKey = new Map(claims.claims.map((row) => [row.stableKey, row.safetyCategory]));
  const reviewByKey = new Map(regulatory.records.map((row) => [row.stableKey, row.reviewStatus]));

  return {
    substances: full.substances.map((row) => ({ ...row, updated_at: null })),
    aliases: full.aliases,
    components: full.components,
    sources: full.sources,
    sourceSubstances: full.sourceSubstances,
    studies: full.studies,
    studySubstances: full.studySubstances,
    claims: full.claims.map((row) => ({
      ...row,
      safety_category: safetyByKey.get(row.stable_key) ?? null,
    })),
    claimSources: full.claimSources,
    evidence: full.evidence,
    regulatory: full.regulatory.map((row) => ({
      ...row,
      review_status: reviewByKey.get(row.stable_key) ?? "review-required",
    })),
  };
}

export function tablesFromPublicBundle(bundle: PublicLexiconBundle): Record<string, unknown[]> {
  return {
    substances: bundle.substances,
    substance_aliases: bundle.aliases,
    substance_components: bundle.components,
    sources: bundle.sources,
    source_substances: bundle.sourceSubstances,
    studies: bundle.studies,
    study_substances: bundle.studySubstances,
    claims: bundle.claims,
    claim_sources: bundle.claimSources,
    evidence_assessments: bundle.evidence,
    regulatory_records: bundle.regulatory,
  };
}

import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import { pendingFamiliesFromShop } from "@/lib/peptide/lexiconV2/families";
import type { LexiconContentReport } from "@/lib/peptide/lexiconV2/contentEngine/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";
import type { ProfileSource } from "@/lib/peptide/profiles/types";
function countByCategory(entries: readonly { category: ShopCoverageCategory }[]): Record<ShopCoverageCategory, number> {
  const counts: Record<ShopCoverageCategory, number> = {
    PEPTIDES: 0,
    ORALS: 0,
    "OILS / INJECTABLES": 0,
    BLENDS: 0,
    HILFSSTOFFE: 0,
    SONSTIGE: 0,
  };
  for (const entry of entries) {
    counts[entry.category] += 1;
  }
  return counts;
}

export function buildLexiconContentReport(): LexiconContentReport {
  const catalog = buildPublicLexiconV2Catalog();
  const pending = pendingFamiliesFromShop();

  let complete = 0;
  let partial = 0;
  let insufficient = 0;

  for (const entry of catalog.entries) {
    if (entry.contentStatus === "COMPLETE") complete += 1;
    else if (entry.contentStatus === "PARTIAL") partial += 1;
    else insufficient += 1;
  }

  let sourceCount = 0;
  for (const entry of catalog.entries) {
    sourceCount += entry.sources.length;
  }

  let reconstitutionProfiles = 0;
  for (const entry of catalog.entries) {
    if (entry.reconstitution?.applicable) reconstitutionProfiles += 1;
  }

  let communityVerified = 0;
  let profilesWithGermanDescription = 0;
  let profilesWithStudyLandscape = 0;
  let profilesWithRisks = 0;
  let profilesWithCommunity = 0;
  const sourcesByType = { pubmed: 0, clinicalTrial: 0, fda: 0, ema: 0, other: 0 };

  function countSource(source: ProfileSource) {
    if (source.pmid) sourcesByType.pubmed += 1;
    else if (source.clinicalTrialId) sourcesByType.clinicalTrial += 1;
    else if (source.publisher === "FDA") sourcesByType.fda += 1;
    else if (source.publisher === "EMA") sourcesByType.ema += 1;
    else sourcesByType.other += 1;
  }

  for (const entry of catalog.entries) {
    communityVerified += entry.community.channels.reduce((sum, ch) => sum + ch.reports.length, 0);
    if (entry.shortDescriptionDe.length > 20) profilesWithGermanDescription += 1;
    if (entry.studyLandscape.humanStudiesDe.length > 10) profilesWithStudyLandscape += 1;
    if (entry.possibleRisksDe.length > 10) profilesWithRisks += 1;
    if (entry.community.noticeDe.length > 5) profilesWithCommunity += 1;
    for (const source of entry.sources) countSource(source);
  }

  return {
    totalProfiles: catalog.entries.length,
    complete,
    partial,
    reviewRequired: pending.filter((p) => p.status === "REVIEW_REQUIRED").length,
    insufficientData: insufficient,
    byCategory: countByCategory(catalog.entries),
    sourceCount,
    communityVerifiedReports: communityVerified,
    reconstitutionProfiles,
    profilesWithGermanDescription,
    profilesWithStudyLandscape,
    profilesWithRisks,
    profilesWithReconstitution: reconstitutionProfiles,
    profilesWithCommunity,
    sourcesByType,
  };
}

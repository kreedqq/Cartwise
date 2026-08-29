import { PEPTIDE_SUBSTANCES, PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { identitySeedFromCatalog } from "@/lib/peptide/persistence/identitySeed";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { publishedScienceSeed } from "@/lib/peptide/persistence/publishedScienceSeed";
import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import { sortedCopy } from "@/lib/peptide/persistence/dualRead/empty";
import type {
  NormalizedClaim,
  NormalizedDetail,
  NormalizedEvidence,
  NormalizedIdentity,
  NormalizedListItem,
  NormalizedProductMap,
  NormalizedRegulatory,
  NormalizedResearchSnapshot,
  NormalizedReviewAction,
  NormalizedSource,
  NormalizedStudy,
} from "@/lib/peptide/persistence/dualRead/types";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import { substanceSlugForProduct } from "@/lib/peptide/search";

function identityFromCatalog(): NormalizedIdentity[] {
  const seed = identitySeedFromCatalog();
  return seed.map((row) => ({
    slug: row.slug,
    name: row.name,
    displayName: row.displayName,
    aliases: row.aliases.filter((entry) => entry.aliasType === "common_name").map((entry) => entry.alias),
    developmentNames: row.aliases.filter((entry) => entry.aliasType === "development_name").map((entry) => entry.alias),
    category: row.category,
    moleculeType: row.moleculeType,
    chemicalClass: row.chemicalClass,
    casNumber: row.casNumber,
    identityNote: row.identityNote,
    lifecycleStatus: row.status,
    blendComponentSlugs: [...row.componentSlugs],
  }));
}

function listItemsFromMergedCatalog(): NormalizedListItem[] {
  return PEPTIDE_SUBSTANCES.map((item) => ({
    slug: item.slug,
    category: item.category,
    evidenceLevel: item.evidenceLevel,
    regulatoryStatus: item.regulatoryStatus,
    casNumber: item.casNumber,
  }));
}

function identityFallback(slug: string): NormalizedIdentity {
  const item = PEPTIDE_SUBSTANCES_IDENTITY.find((row) => row.slug === slug);
  return {
    slug,
    name: item?.name ?? slug,
    displayName: item?.displayName ?? slug,
    aliases: item?.aliases ?? [],
    developmentNames: item?.developmentNames ?? [],
    category: item?.category ?? "peptides",
    moleculeType: item?.moleculeType ?? null,
    chemicalClass: item?.chemicalClass ?? null,
    casNumber: item?.casNumber ?? null,
    identityNote: item?.identityNote ?? null,
    lifecycleStatus: item?.moleculeType === "blend" ? "blend" : "active",
    blendComponentSlugs: item?.blendComponentSlugs ?? [],
  };
}

function detailsFromPublished(identities: NormalizedIdentity[]): NormalizedDetail[] {
  const bySlug = new Map(identities.map((row) => [row.slug, row]));
  return listPublishedProfiles().map((profile) => {
    const identity = bySlug.get(profile.slug) ?? identityFallback(profile.slug);
    return {
      slug: profile.slug,
      identity,
      overview: profile.summary.whatIsIt.text,
      mechanism: profile.summary.mechanism.text,
      effects: profile.summary.humanEvidence.text,
      safety: profile.summary.safety.text,
      interactions: profile.interactions.map((item) => item.text),
      reconstitution: profile.reconstitution?.text ?? null,
      studyNcts: profile.studies.map((study) => study.clinicalTrialId),
      sourceLegacyIds: profile.sources.map((source) => source.id),
      evidenceLevel: profile.evidenceLevel,
      evidenceType: "human",
      evidenceReviewStatus: "approved",
      confidence: profile.confidenceLevel,
      regulatory: profile.sources
        .filter((source) => source.sourceType === "regulatory")
        .map((source) => ({
          authority:
            source.url.includes("ema.europa.eu")
              ? "ema"
              : source.url.includes("fda") || source.url.includes("dailymed")
                ? "fda"
                : "other",
          region: "",
          status: profile.regulatoryStatus,
          productName: null,
          applicationId: null,
          isCurrent: true,
        })),
    };
  });
}

export function normalizeLegacyResearch(): NormalizedResearchSnapshot {
  const science = publishedScienceSeed();
  const claimsSeed = publishedClaimsSeed();
  const regulatorySeed = publishedRegulatorySeed();
  const identities = identityFromCatalog();

  const sources: NormalizedSource[] = science.sources.map((row) => ({
    key: row.key,
    title: row.title,
    sourceType: row.sourceType,
    doi: row.doi,
    pmid: row.pmid,
    nctId: row.nctId,
    url: row.url,
    publisher: row.publisher,
    publicationDate: row.publicationDate,
    accessDate: row.accessDate,
    legacyIds: [...row.legacyIds],
    substanceSlugs: [...row.substanceSlugs],
    reviewStatus: "approved",
  }));

  const studies: NormalizedStudy[] = science.studies.map((row) => ({
    nctId: row.nctId,
    title: row.title,
    sponsor: row.sponsor,
    phase: row.phase,
    status: row.status,
    enrollment: row.enrollment,
    startDate: row.startDate,
    completionDate: row.completionDate,
    lastUpdated: row.lastUpdated,
    hasResults: row.hasResults,
    url: row.url,
    substanceSlugs: [...row.substanceSlugs],
    reviewStatus: "approved",
  }));

  const claims: NormalizedClaim[] = claimsSeed.claims.map((row) => ({
    stableKey: row.stableKey,
    substanceSlug: row.substanceSlug,
    claimType: row.claimType,
    statement: row.statement,
    status: row.status,
    sourceLegacyIds: [...row.legacySourceIds],
    nctIds: [...row.nctIds],
  }));

  const evidence: NormalizedEvidence[] = claimsSeed.evidenceAssessments.map((row) => ({
    stableKey: row.stableKey,
    substanceSlug: row.stableKey.split(":")[0] ?? "",
    evidenceLevel: row.evidenceLevel,
    confidence: row.confidence,
    evidenceType: row.evidenceType,
    reviewStatus: row.reviewStatus,
    overlay: row.stableKey.endsWith(":summary.humanEvidence") && row.reviewStatus === "approved",
  }));

  const regulatory: NormalizedRegulatory[] = regulatorySeed.records.map((row) => ({
    stableKey: row.stableKey,
    substanceSlug: row.substanceSlug,
    authority: row.authority,
    region: row.region,
    status: row.status,
    indication: row.indication,
    productName: row.productName,
    applicationId: row.applicationId,
    isCurrent: row.isCurrent,
    legacySourceId: row.legacySourceId,
  }));

  const reviewActions: NormalizedReviewAction[] = regulatorySeed.reviewActions.map((row) => ({
    entityStableKey: row.entityStableKey,
    action: row.action,
    reason: row.reason,
  }));

  const productMaps: NormalizedProductMap[] = LIVE_SHOP_PRODUCTS.map((row) => ({
    code: row.code,
    name: row.name,
    slug: substanceSlugForProduct(row),
  }));

  return {
    identities: sortedCopy(identities, (row) => row.slug),
    listItems: sortedCopy(listItemsFromMergedCatalog(), (row) => row.slug),
    sources: sortedCopy(sources, (row) => row.key),
    sourceAttachments: sortedCopy(
      science.sourceSubstances.map((row) => ({
        sourceKey: row.sourceKey,
        substanceSlug: row.substanceSlug,
        legacySourceId: row.legacySourceId,
      })),
      (row) => `${row.substanceSlug}:${row.legacySourceId}`,
    ),
    studies: sortedCopy(studies, (row) => row.nctId),
    studyAttachments: sortedCopy(
      science.studySubstances.map((row) => ({ nctId: row.nctId, substanceSlug: row.substanceSlug })),
      (row) => `${row.substanceSlug}:${row.nctId}`,
    ),
    claims: sortedCopy(claims, (row) => row.stableKey),
    evidence: sortedCopy(evidence, (row) => row.stableKey),
    regulatory: sortedCopy(regulatory, (row) => row.stableKey),
    reviewActions: sortedCopy(reviewActions, (row) => `${row.entityStableKey}:${row.reason}`),
    productMaps: sortedCopy(productMaps, (row) => row.code.toUpperCase()),
    details: sortedCopy(detailsFromPublished(identities), (row) => row.slug),
    communityReports: [],
  };
}

import { listPublishedProfiles } from "@/lib/peptide/profiles";
import { buildDraftLexiconProfile } from "@/lib/peptide/lexiconV2/buildProfile";
import {
  draftFamiliesFromShop,
  nonLexiconProductCount,
  pendingFamiliesFromShop,
  publishedLexiconSlugs,
} from "@/lib/peptide/lexiconV2/families";
import { shopCoverageMatrix } from "@/lib/peptide/shopCoverage/coverage";
import type { LexiconV2CoverageReport, LexiconV2Profile } from "@/lib/peptide/lexiconV2/types";

const DRAFT_FAMILIES = draftFamiliesFromShop();

export const LEXICON_V2_DRAFT_PROFILES: readonly LexiconV2Profile[] = Object.freeze(
  DRAFT_FAMILIES.map(buildDraftLexiconProfile),
);

const DRAFT_BY_SLUG = new Map(LEXICON_V2_DRAFT_PROFILES.map((profile) => [profile.slug, profile]));

export function getLexiconV2DraftProfile(slug: string): LexiconV2Profile | undefined {
  return DRAFT_BY_SLUG.get(slug);
}

export function listLexiconV2DraftProfiles(): readonly LexiconV2Profile[] {
  return LEXICON_V2_DRAFT_PROFILES;
}

export function listLexiconV2DraftSlugs(): string[] {
  return LEXICON_V2_DRAFT_PROFILES.map((profile) => profile.slug);
}

export function hasLexiconV2Profile(slug: string): boolean {
  return publishedLexiconSlugs().has(slug) || DRAFT_BY_SLUG.has(slug);
}

export function lexiconV2ProfileCount(): number {
  return listPublishedProfiles().length + LEXICON_V2_DRAFT_PROFILES.length;
}

export function buildLexiconV2CoverageReport(): LexiconV2CoverageReport {
  const rows = shopCoverageMatrix();
  const pending = pendingFamiliesFromShop();

  const beforeComplete = rows.filter((row) => row.status === "COMPLETE").length;
  const beforePartial = rows.filter((row) => row.status === "PARTIAL").length;

  let withProfile = 0;
  let draftOnly = 0;
  let publishedComplete = 0;
  let pendingSkus = 0;

  for (const row of rows) {
    if (row.status === "NON_LEXICON") continue;
    const slug = row.familySlug;
    if (!slug) {
      pendingSkus += 1;
      continue;
    }
    if (row.status === "COMPLETE") {
      withProfile += 1;
      publishedComplete += 1;
      continue;
    }
    if (row.status === "PARTIAL" && DRAFT_BY_SLUG.has(slug)) {
      withProfile += 1;
      draftOnly += 1;
      continue;
    }
    pendingSkus += 1;
  }

  return {
    profilesBefore: listPublishedProfiles().length,
    profilesAfter: lexiconV2ProfileCount(),
    newDraftProfiles: LEXICON_V2_DRAFT_PROFILES.length,
    publishedProfiles: listPublishedProfiles().length,
    reviewRequiredFamilies: pending.filter((item) => item.status === "REVIEW_REQUIRED").length,
    unknownFamilies: pending.filter((item) => item.status === "UNKNOWN").length,
    nonLexiconProducts: nonLexiconProductCount(),
    shopSkusBefore: {
      complete: beforeComplete,
      partial: beforePartial,
      total: rows.length,
    },
    shopSkusAfter: {
      withProfile,
      draftOnly,
      publishedComplete,
      pending: pendingSkus,
      total: rows.length,
    },
    newProfileNamesDe: LEXICON_V2_DRAFT_PROFILES.map((profile) => profile.displayNameDe).sort((a, b) =>
      a.localeCompare(b, "de"),
    ),
  };
}

export function shopSkuHasLexiconV2Profile(familySlug: string | null, status: string): boolean {
  if (!familySlug) return false;
  if (status === "COMPLETE") return publishedLexiconSlugs().has(familySlug);
  if (status === "PARTIAL") return DRAFT_BY_SLUG.has(familySlug);
  return false;
}

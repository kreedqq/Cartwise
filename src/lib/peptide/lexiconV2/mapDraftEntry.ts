import { catalogNamesForSlug } from "@/lib/peptide/shopCoverage/names";
import type { PublicLexiconEntry } from "@/lib/peptide/lexiconV2/publicTypes";
import type { LexiconV2Profile } from "@/lib/peptide/lexiconV2/types";

export function mapDraftProfileToEntry(profile: LexiconV2Profile, extraSearchTerms: string[] = []): PublicLexiconEntry {
  const aliases = [...catalogNamesForSlug(profile.slug), ...extraSearchTerms].filter(Boolean);

  return {
    slug: profile.slug,
    displayNameDe: profile.displayNameDe,
    category: profile.category,
    searchTerms: [profile.displayNameDe, profile.slug, ...aliases],
    publicationStatus: "draft",
    contentStatus: profile.contentStatus,
    identityNote: profile.identityNote,
    shortDescriptionDe: profile.shortDescriptionDe,
    usesAndResearchDe: profile.usesAndResearchDe.text,
    possibleBenefitsDe: profile.possibleBenefitsDe.text,
    possibleRisksDe: profile.possibleRisksDe.text,
    applicationFormDe: profile.applicationFormDe.text,
    reconstitution: profile.reconstitution,
    studyLandscape: {
      humanStudiesDe: profile.studyLandscapeDe.humanStudiesNoteDe,
      preclinicalDe: profile.studyLandscapeDe.preclinicalNoteDe,
      studyStatusDe: profile.studyLandscapeDe.studyStatusDe,
    },
    community: {
      available: profile.community.available,
      noticeDe: profile.community.noticeDe,
      channels: profile.community.channels,
    },
    sources: profile.sources,
    blendComponentSlugs: profile.blendComponentSlugs,
  };
}

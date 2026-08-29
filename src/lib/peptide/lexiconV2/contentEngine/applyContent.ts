import { COMMUNITY_NOTICE_DE, INSUFFICIENT_DATA_DE } from "@/lib/peptide/lexiconV2/contentEngine/constants";
import { formatBenefitsDe, getBenefitsProfile, hasPositiveEffects } from "@/lib/peptide/lexiconV2/contentEngine/benefits";
import { getCuratedContentPack } from "@/lib/peptide/lexiconV2/contentEngine/curated";
import {
  fallbackIdentityBrief,
  getIdentityBrief,
} from "@/lib/peptide/lexiconV2/contentEngine/identityBriefs";
import { germanDisplayNameForSlug } from "@/lib/peptide/lexiconV2/germanNames";
import type { LexiconContentPack, LexiconContentStatus } from "@/lib/peptide/lexiconV2/contentEngine/types";
import type { LexiconV2FamilyBundle, LexiconV2Profile } from "@/lib/peptide/lexiconV2/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";
function emptyCommunityChannels() {
  return (["reddit", "forum", "blog", "user-report"] as const).map((kind) => ({
    kind,
    enabled: false,
    reports: [],
  }));
}

function resolveBenefitsForPack(pack: LexiconContentPack): string {
  const profile = getBenefitsProfile(pack.slug, pack.blendComponentSlugs ?? []);
  if (profile && (hasPositiveEffects(profile) || profile.specificEvidenceNote)) {
    return formatBenefitsDe(profile);
  }
  return pack.possibleBenefitsDe;
}

function applyCuratedPack(base: LexiconV2Profile, pack: LexiconContentPack): LexiconV2Profile {
  const benefitsText = resolveBenefitsForPack(pack);
  return {
    ...base,
    contentStatus: pack.contentStatus,
    identityNote: pack.identityNote ?? base.identityNote,
    blendComponentSlugs: pack.blendComponentSlugs ?? base.blendComponentSlugs,
    shortDescriptionDe: pack.shortDescriptionDe,
    usesAndResearchDe: { text: pack.usesAndResearchDe, sourceIds: pack.sources.map((s) => s.id) },
    possibleBenefitsDe: { text: benefitsText, sourceIds: pack.sources.map((s) => s.id) },
    possibleRisksDe: { text: pack.possibleRisksDe, sourceIds: pack.sources.map((s) => s.id) },
    applicationFormDe: { text: pack.applicationFormDe, sourceIds: [] },
    studyLandscapeDe: {
      humanStudiesNoteDe: pack.humanStudiesDe,
      preclinicalNoteDe: pack.preclinicalDe,
      studyStatusDe: pack.studyStatusDe,
      sourceIds: pack.sources.map((s) => s.id),
    },
    sources: pack.sources,
    community: {
      separatedFromScience: true,
      available: false,
      noticeDe: COMMUNITY_NOTICE_DE,
      channels: emptyCommunityChannels(),
    },
  };
}

function categoryLabel(category: ShopCoverageCategory): string {
  switch (category) {
    case "PEPTIDES":
      return "Peptid";
    case "ORALS":
      return "orale Substanz";
    case "OILS / INJECTABLES":
      return "injizierbare Öl-/Esterlösung";
    case "BLENDS":
      return "Blend-Mischung";
    case "SONSTIGE":
      return "Sonstige Substanz";
    default:
      return "Substanz";
  }
}

function applyPartialIdentity(base: LexiconV2Profile, family: LexiconV2FamilyBundle): LexiconV2Profile {
  const identity = getIdentityBrief(family);
  const name = germanDisplayNameForSlug(family.slug, family.substanceLabel);
  const kind = categoryLabel(family.category);
  const status: LexiconContentStatus = "PARTIAL";

  const usesText =
    family.category === "BLENDS"
      ? `${name} ist als ${kind} im Katalog dokumentiert. Bestandteile sind separat zu prüfen. Für die Mischung als Ganzes liegen keine einheitlichen Humanstudien vor. ${INSUFFICIENT_DATA_DE}`
      : `${name} ist als ${kind} im Shop-Katalog identifiziert. Bekannte medizinische oder Forschungskontexte sind für diese Identität noch nicht vollständig kuratiert. ${INSUFFICIENT_DATA_DE}`;

  const benefitsText = (() => {
    const profile = getBenefitsProfile(family.slug, identity.blendComponentSlugs ?? []);
    if (profile && (hasPositiveEffects(profile) || profile.specificEvidenceNote)) {
      return formatBenefitsDe(profile);
    }
    return family.category === "PEPTIDES"
      ? `Für ${name} wurden in der Forschung verschiedene Wirkmechanismen untersucht; die Human-Evidenz ist je nach Endpunkt unterschiedlich und noch nicht vollständig kuratiert.`
      : `Für ${name} existieren je nach Wirkstoffklasse unterschiedliche pharmakologische Effekte, die hier noch nicht vollständig dokumentiert sind.`;
  })();

  const risksText =
    family.category === "ORALS" || family.category === "OILS / INJECTABLES"
      ? `Für ${name} gelten je nach Wirkstoffklasse bekannte pharmakologische Risiken, die hier noch nicht vollständig dokumentiert sind. ${INSUFFICIENT_DATA_DE}`
      : INSUFFICIENT_DATA_DE;

  const humanText = `Humane Studienlage für ${name}: noch nicht vollständig kuratiert. ${INSUFFICIENT_DATA_DE}`;
  const preclinicalText = `Präklinische Forschung zu ${name}: noch nicht vollständig kuratiert. ${INSUFFICIENT_DATA_DE}`;

  return {
    ...base,
    contentStatus: status,
    identityNote: identity.identityNote ?? base.identityNote,
    blendComponentSlugs: identity.blendComponentSlugs ?? [],
    shortDescriptionDe: identity.shortDescriptionDe,
    usesAndResearchDe: { text: usesText, sourceIds: [] },
    possibleBenefitsDe: { text: benefitsText, sourceIds: [] },
    possibleRisksDe: { text: risksText, sourceIds: [] },
    applicationFormDe: {
      text: `${name} wird im Shop als ${kind} geführt. Dies beschreibt nur die Katalog-Darreichungsform – keine Anwendungsempfehlung.`,
      sourceIds: [],
    },
    studyLandscapeDe: {
      humanStudiesNoteDe: humanText,
      preclinicalNoteDe: preclinicalText,
      studyStatusDe: "Wissenschaftliche Kuratierung teilweise ausstehend; begrenzte belastbare Quellen.",
      sourceIds: [],
    },
    sources: [],
    community: {
      separatedFromScience: true,
      available: false,
      noticeDe: COMMUNITY_NOTICE_DE,
      channels: emptyCommunityChannels(),
    },
  };
}

export function enrichDraftProfileWithContent(base: LexiconV2Profile, family: LexiconV2FamilyBundle): LexiconV2Profile {
  const curated = getCuratedContentPack(family.slug);
  if (curated) return applyCuratedPack(base, curated);
  return applyPartialIdentity(base, family);
}

export function publishedContentStatus(): LexiconContentStatus {
  return "COMPLETE";
}

export { fallbackIdentityBrief };

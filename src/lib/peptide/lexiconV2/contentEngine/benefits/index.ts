import { PUBLISHED_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/publishedBenefits";
import { ORAL_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/oralBenefits";
import { OIL_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/oilBenefits";
import { PEPTIDE_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/peptideBenefits";
import { SONSTIGE_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/sonstigeBenefits";
import { BLEND_BENEFITS, buildBlendBenefits } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/blendBenefits";
import {
  formatBenefitsDe,
  hasPositiveEffects,
  isGenericBenefitsText,
} from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
import type { BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

/** Authoritative benefits catalog for all 159 public lexicon profiles. */
export const BENEFITS_BY_SLUG: Record<string, BenefitsProfile> = {
  ...PEPTIDE_BENEFITS,
  ...ORAL_BENEFITS,
  ...OIL_BENEFITS,
  ...SONSTIGE_BENEFITS,
  ...BLEND_BENEFITS,
  ...PUBLISHED_BENEFITS,
};

export function getBenefitsProfile(slug: string, blendComponentSlugs: string[] = []): BenefitsProfile | undefined {
  if (BENEFITS_BY_SLUG[slug]) return BENEFITS_BY_SLUG[slug];
  if (blendComponentSlugs.length > 0) return buildBlendBenefits(slug, blendComponentSlugs);
  return undefined;
}

export function resolveBenefitsText(
  slug: string,
  fallbackText: string,
  blendComponentSlugs: string[] = [],
): string {
  const profile = getBenefitsProfile(slug, blendComponentSlugs);
  if (profile && hasPositiveEffects(profile)) {
    return formatBenefitsDe(profile);
  }
  if (profile?.specificEvidenceNote) {
    return profile.specificEvidenceNote;
  }
  if (!isGenericBenefitsText(fallbackText)) {
    return fallbackText;
  }
  return fallbackText;
}

export function benefitsCatalogCoverage(): { total: number; slugs: string[] } {
  return { total: Object.keys(BENEFITS_BY_SLUG).length, slugs: Object.keys(BENEFITS_BY_SLUG).sort() };
}

export {
  formatBenefitsDe,
  hasPositiveEffects,
  isGenericBenefitsText,
  primaryBenefitTier,
} from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
export { buildBlendBenefits } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/blendBenefits";

/** Apply authoritative benefits text to a public-facing entry. */
export function enrichEntryBenefits<
  T extends { slug: string; possibleBenefitsDe: string; blendComponentSlugs?: string[] },
>(entry: T): T {
  const profile = getBenefitsProfile(entry.slug, entry.blendComponentSlugs ?? []);
  if (profile && (hasPositiveEffects(profile) || profile.specificEvidenceNote)) {
    return { ...entry, possibleBenefitsDe: formatBenefitsDe(profile) };
  }
  return entry;
}

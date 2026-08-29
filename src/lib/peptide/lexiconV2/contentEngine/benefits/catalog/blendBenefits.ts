import { PUBLISHED_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/publishedBenefits";
import { ORAL_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/oralBenefits";
import { OIL_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/oilBenefits";
import { PEPTIDE_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/peptideBenefits";
import { SONSTIGE_BENEFITS } from "@/lib/peptide/lexiconV2/contentEngine/benefits/catalog/sonstigeBenefits";
import { bp, formatBenefitsDe } from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
import type { BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";
import { germanDisplayNameForSlug } from "@/lib/peptide/lexiconV2/germanNames";

const COMPONENT_BENEFITS: Record<string, BenefitsProfile> = {
  ...PEPTIDE_BENEFITS,
  ...ORAL_BENEFITS,
  ...OIL_BENEFITS,
  ...SONSTIGE_BENEFITS,
  ...PUBLISHED_BENEFITS,
};

function componentBenefitLine(slug: string): string | null {
  const profile = COMPONENT_BENEFITS[slug];
  if (!profile) return null;
  const name = germanDisplayNameForSlug(slug, slug);
  const parts: string[] = [];
  if (profile.wellEstablished.length > 0) {
    parts.push(profile.wellEstablished[0]!);
  } else if (profile.possible.length > 0) {
    parts.push(profile.possible[0]!);
  } else if (profile.preclinical.length > 0) {
    parts.push(profile.preclinical[0]!);
  }
  if (parts.length === 0) return null;
  return `Für ${name}: ${parts[0]}`;
}

export function buildBlendBenefits(slug: string, componentSlugs: string[]): BenefitsProfile {
  const componentLines = componentSlugs
    .map(componentBenefitLine)
    .filter((line): line is string => Boolean(line));

  return bp(slug, {
    p: componentLines.length > 0 ? componentLines : undefined,
    note:
      "Für die konkrete Blend-Mischung liegen keine ausreichenden klinischen Studien vor. Aussagen zu Einzelkomponenten dürfen nicht automatisch auf die Mischung übertragen werden.",
  });
}

export const BLEND_BENEFITS: Record<string, BenefitsProfile> = {
  "mast-blend": buildBlendBenefits("mast-blend", ["drostanolone-propionate", "drostanolone-enanthate"]),
  nandromix: buildBlendBenefits("nandromix", ["nandrolone-decanoate", "nandrolone-phenylpropionate"]),
  "slu-pp-332-bam15-blend": buildBlendBenefits("slu-pp-332-bam15-blend", ["slu-pp-332", "bam15"]),
  trenmix: buildBlendBenefits("trenmix", ["trenbolone-acetate", "trenbolone-enanthate"]),
  "tritren-225": buildBlendBenefits("tritren-225", [
    "trenbolone-acetate",
    "trenbolone-enanthate",
    "trenbolone-hexahydrobenzylcarbonate",
  ]),
  sustanon: buildBlendBenefits("sustanon", [
    "testosterone-propionate",
    "testosterone-phenylpropionate",
    "testosterone-isocaproate",
    "testosterone-decanoate",
  ]),
  supertest: buildBlendBenefits("supertest", [
    "testosterone-propionate",
    "testosterone-enanthate",
    "testosterone-cypionate",
  ]),
};

/** Re-export for tests that need formatted blend text. */
export function formatBlendBenefitsDe(slug: string, componentSlugs: string[]): string {
  return formatBenefitsDe(buildBlendBenefits(slug, componentSlugs));
}

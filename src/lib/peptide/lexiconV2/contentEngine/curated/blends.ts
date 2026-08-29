import type { LexiconContentPack } from "@/lib/peptide/lexiconV2/contentEngine/types";
import { INSUFFICIENT_DATA_DE } from "@/lib/peptide/lexiconV2/contentEngine/constants";

function blendPack(
  slug: string,
  displayNameDe: string,
  componentSlugs: string[],
  componentNamesDe: string,
  identityNote?: string,
): LexiconContentPack {
  return {
    slug,
    contentStatus: "PARTIAL",
    blendComponentSlugs: componentSlugs,
    identityNote,
    shortDescriptionDe: `${displayNameDe} ist eine Shop-Blend-Mischung aus ${componentNamesDe}. Blends werden im Katalog als eigene Identität geführt – nicht als einheitlich untersuchter Wirkstoff.`,
    usesAndResearchDe: `Die Einzelkomponenten (${componentNamesDe}) können in der medizinischen oder Forschungsliteratur separat beschrieben sein. Für die Blend-Mischung selbst liegen keine einheitlichen Humanstudien vor. ${INSUFFICIENT_DATA_DE}`,
    possibleBenefitsDe: `Für die Blend-Mischung als Ganzes liegen keine belastbaren Humanstudien vor. Aussagen zu Einzelkomponenten dürfen nicht automatisch auf die Mischung übertragen werden. ${INSUFFICIENT_DATA_DE}`,
    possibleRisksDe: `Risiken ergeben sich potenziell aus der Kombination der Einzelkomponenten; für die spezifische Shop-Blend-Formulierung liegen keine etablierten Sicherheitsdaten vor. ${INSUFFICIENT_DATA_DE}`,
    applicationFormDe: `${displayNameDe} wird im Shop als fertige Blend-Darreichungsform geführt. Dies beschreibt nur die Katalogform – keine Anwendungsempfehlung.`,
    humanStudiesDe: `Keine Humanstudien zur Blend-Mischung als Ganzes identifiziert. Einzelkomponenten können separate Studienlagen haben.`,
    preclinicalDe: "Präklinische Blend-spezifische Daten: nicht identifiziert. Einzelkomponenten können separate präklinische Literatur haben.",
    studyStatusDe: "Blend ohne einheitliche Humanstudie; Einzelkomponenten separat zu prüfen.",
    sources: [],
  };
}

export const MAST_BLEND_CONTENT = blendPack(
  "mast-blend",
  "MAST Blend",
  ["drostanolone-propionate", "drostanolone-enanthate"],
  "Drostanolon-Propionat und Drostanolon-Enanthat",
  "Blend-Identität; Einzelkomponenten sind separat zu prüfen.",
);

export const NANDROMIX_CONTENT = blendPack(
  "nandromix",
  "NANDROMIX",
  ["nandrolone-decanoate", "nandrolone-phenylpropionate"],
  "Nandrolon-Decanoat und Nandrolon-Phenylpropionat",
);

export const SLU_BAM15_BLEND_CONTENT = blendPack(
  "slu-pp-332-bam15-blend",
  "SLU-PP-332 + BAM15 Blend",
  ["slu-pp-332", "bam15"],
  "SLU-PP-332 und BAM15",
);

export const TRENMIX_CONTENT = blendPack(
  "trenmix",
  "Trenmix",
  ["trenbolone-acetate", "trenbolone-enanthate"],
  "Trenbolon-Acetat und Trenbolon-Enanthat",
);

export const TRITREN_CONTENT = blendPack(
  "tritren-225",
  "Tri-Tren 225",
  ["trenbolone-acetate", "trenbolone-enanthate", "trenbolone-hexahydrobenzylcarbonate"],
  "mehrere Trenbolon-Ester",
);

export const KLOW_BLEND_CONTENT: LexiconContentPack = {
  slug: "klow-blend",
  contentStatus: "PARTIAL",
  blendComponentSlugs: ["ghk-cu", "tb-500", "bpc-157"],
  identityNote:
    "KLOW ist nicht identisch mit GLOW-Blend. Laut Shop-Katalogbezeichnung enthält KLOW zusätzliches TB-500 gegenüber GLOW (GHK-Cu 50 mg + TB-500 10 mg + BPC-157 10 mg + TB-500 10 mg).",
  shortDescriptionDe:
    "KLOW ist eine Shop-Blend-Mischung aus GHK-Cu, TB-500 und BPC-157 – eigene Katalogidentität, getrennt von GLOW.",
  usesAndResearchDe:
    "Die Einzelkomponenten (GHK-Cu, TB-500, BPC-157) werden in der medizinischen oder Forschungsliteratur separat beschrieben. Für die KLOW-Blend-Mischung als Ganzes liegen keine einheitlichen Humanstudien vor. Die verfügbaren wissenschaftlichen Daten beziehen sich auf einzelne Bestandteile; die Kombination als KLOW-Blend ist nicht entsprechend klinisch untersucht.",
  possibleBenefitsDe:
    "Für die KLOW-Blend-Mischung als Ganzes liegen keine belastbaren Humanstudien vor. Aussagen zu Einzelkomponenten dürfen nicht automatisch auf die Mischung übertragen werden.",
  possibleRisksDe:
    "Risiken ergeben sich potenziell aus der Kombination der Einzelkomponenten; für die spezifische KLOW-Shop-Blend-Formulierung liegen keine etablierten Sicherheitsdaten vor. Die verfügbaren Sicherheitsdaten beziehen sich auf Einzelkomponenten, nicht auf die Kombination als KLOW-Blend.",
  applicationFormDe:
    "KLOW wird im Shop als fertige Blend-Darreichungsform geführt. Dies beschreibt nur die Katalogform – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Keine Humanstudien zur KLOW-Blend-Mischung als Ganzes identifiziert. Einzelkomponenten können separate Studienlagen haben.",
  preclinicalDe:
    "Präklinische Blend-spezifische Daten zur KLOW-Kombination: nicht identifiziert. Einzelkomponenten können separate präklinische Literatur haben.",
  studyStatusDe:
    "Blend ohne einheitliche Humanstudie; Einzelkomponenten separat zu prüfen.",
  sources: [],
};

export const BLEND_PACKS: Record<string, LexiconContentPack> = {
  "mast-blend": MAST_BLEND_CONTENT,
  nandromix: NANDROMIX_CONTENT,
  "slu-pp-332-bam15-blend": SLU_BAM15_BLEND_CONTENT,
  trenmix: TRENMIX_CONTENT,
  "tritren-225": TRITREN_CONTENT,
  "klow-blend": KLOW_BLEND_CONTENT,
};

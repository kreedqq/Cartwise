import { germanDisplayNameForSlug } from "@/lib/peptide/lexiconV2/germanNames";
import { INSUFFICIENT_DATA_DE } from "@/lib/peptide/lexiconV2/contentEngine/constants";
import type { IdentityBrief } from "@/lib/peptide/lexiconV2/contentEngine/types";
import type { LexiconV2FamilyBundle } from "@/lib/peptide/lexiconV2/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

/** Identity-level briefs without unbelegte klinische Claims. Overrides fallback per slug. */
export const HAND_CURATED_IDENTITY: Record<string, IdentityBrief> = {
  "ss-31": {
    shortDescriptionDe:
      "SS-31 ist der Forschungsname für Elamipretid, ein mitochondrien-zielendes Tetrapeptid (INN: Elamipretide).",
  },
  adipotide: {
    shortDescriptionDe:
      "Adipotide (FTPP) ist ein synthetisches chimäres Forschungspeptid zur zielgerichteten Ansprache von Fettgewebe-Gefäßen.",
  },
  "5-amino-1mq": {
    shortDescriptionDe:
      "5-Amino-1MQ ist ein kleines Molekül (kein Peptid) und NNMT-Inhibitor aus der Stoffwechselforschung.",
  },
  dsip: {
    shortDescriptionDe:
      "DSIP (Delta-Sleep-Inducing Peptide) ist ein neuropeptidartiges Forschungspeptid, das erstmals im Kontext Schlaf-Forschung beschrieben wurde.",
  },
  epithalon: {
    shortDescriptionDe:
      "Epithalon (Epitalon) ist ein synthetisches Tetrapeptid, das in der Alterungs- und Telomere-Forschung diskutiert wird.",
  },
  "pt-141": {
    shortDescriptionDe:
      "PT-141 (Bremelanotid) ist ein synthetisches Peptid und Melanocortin-Rezeptor-Agonist, der in klinischen Programmen untersucht wurde.",
  },
  "melanotan-i": {
    shortDescriptionDe: "Melanotan I (Afamelanotid) ist ein synthetisches α-MSH-Analogon – nicht identisch mit Melanotan II.",
    identityNote: "Melanotan I (Afamelanotid) ≠ Melanotan II. Getrennte Identitäten und Profile.",
  },
  "klow-blend": {
    shortDescriptionDe:
      "KLOW ist eine Shop-Blend-Mischung aus GHK-Cu, TB-500 und BPC-157 – eigene Katalogidentität, getrennt von GLOW.",
    blendComponentSlugs: ["ghk-cu", "tb-500", "bpc-157"],
    identityNote:
      "KLOW ist nicht identisch mit GLOW-Blend. Laut Shop-Katalogbezeichnung enthält KLOW zusätzliches TB-500 gegenüber GLOW (GHK-Cu 50 mg + TB-500 10 mg + BPC-157 10 mg + TB-500 10 mg).",
  },
  "cjc-ipamorelin-blend": {
    shortDescriptionDe: "CJC-1295 (ohne DAC) + Ipamorelin als kombinierte Shop-Blend.",
    blendComponentSlugs: ["cjc-1295", "ipamorelin"],
  },
  "mast-blend": {
    shortDescriptionDe: "Masteron-Blend (Drostanolon-Mischung) im Shop-Katalog – Blend, kein einzelner INN.",
    identityNote: "Blend-Identität; Einzelkomponenten sind separat zu prüfen.",
    blendComponentSlugs: ["drostanolone-propionate", "drostanolone-enanthate"],
  },
  tritren: {
    shortDescriptionDe: "Tri-Tren ist eine Kombination mehrerer Trenbolon-Ester im Shop – Blend ohne einheitliche Humanstudie.",
  },
  "tritren-225": {
    shortDescriptionDe: "Tri-Tren 225 mg ist eine Kombination mehrerer Trenbolon-Ester – Shop-Blend ohne einheitliche Humanstudie.",
  },
  "ghrp-2": {
    shortDescriptionDe: "GHRP-2 (Growth Hormone Releasing Peptide 2) ist ein synthetisches GHS-Rezeptor-agonistisches Peptid.",
  },
  "ghrp-6": {
    shortDescriptionDe: "GHRP-6 ist ein synthetisches Peptid aus der GHRP-Familie (Ghrelin-Rezeptor-Agonismus in der Forschung).",
  },
  hexarelin: {
    shortDescriptionDe: "Hexarelin ist ein synthetisches Hexapeptid und GH-Sekretagoge aus der Forschung.",
  },
  "peg-mgf": {
    shortDescriptionDe: "PEG-MGF ist ein pegyliertes Mechano Growth Factor-Derivat – Forschungspeptid, nicht identisch mit IGF-1 LR3.",
    identityNote: "PEG-MGF ≠ IGF-1 LR3 ≠ Mecasermin.",
  },
  mgf: {
    shortDescriptionDe: "MGF (Mechano Growth Factor) bezeichnet ein IGF-1-Splice-Varianten-Fragment aus der Muskel-Forschung.",
  },
  ll37: {
    shortDescriptionDe: "LL-37 ist ein antimikrobielles Cathelicidin-Peptid des angeborenen Immunsystems.",
  },
  "ara-290": {
    shortDescriptionDe: "ARA-290 (Cibinetide) ist ein EPO-abgeleitetes Peptid, das in neuropathischer Schmerz-Forschung untersucht wurde.",
  },
  humanin: {
    shortDescriptionDe: "Humanin ist ein mitochondriales Peptid, das in Langlebigkeits- und Neurodegenerations-Forschung untersucht wird.",
  },
  foxo4: {
    shortDescriptionDe: "FOXO4-DRI ist ein D-retro-inverses Peptid aus der Senolytik-Forschung (Zellalterung).",
  },
  dihexa: {
    shortDescriptionDe: "Dihexa ist ein kleines Molekül (Angiotensin-IV-Analogon) aus der kognitiven Forschung – kein klassisches Peptid.",
  },
  "pe-22-28": {
    shortDescriptionDe: "PE-22-28 ist ein Sp8-Transkriptionsfaktor-Modulator-Peptid aus der Neurogenese-Forschung.",
  },
  adamax: {
    shortDescriptionDe: "Adamax ist ein modifiziertes Semax-Derivat – getrennte Identität von Semax.",
    identityNote: "Adamax ≠ Semax. Modifizierte Analoge bleiben eigene Profile.",
  },
  "na-semax-amide": {
    shortDescriptionDe: "N-Acetyl-Semax-Amid ist ein modifiziertes Semax-Derivat.",
    identityNote: "N-Acetyl-Semax-Amid ≠ Semax. Amid-Varianten bleiben eigene Profile.",
  },
  "na-selank-amide": {
    shortDescriptionDe: "N-Acetyl-Selank-Amid ist ein modifiziertes Selank-Derivat.",
    identityNote: "N-Acetyl-Selank-Amid ≠ Selank. Amid-Varianten bleiben eigene Profile.",
  },
  "ace-031": {
    shortDescriptionDe: "ACE-031 ist ein rekombinanter Aktivin-Typ-II-Rezeptor-Fc-Fusionsprotein-Kandidat aus der Muskel-Forschung.",
  },
  aicar: {
    shortDescriptionDe: "AICAR (Acadesin) ist ein AMPK-Aktivator und Nucleosid-Analogon – kein Peptid.",
  },
  cardarine: {
    shortDescriptionDe: "GW-501516 (Cardarine) ist ein PPARδ-Agonist aus der Ausdauer- und Stoffwechsel-Forschung – kein Peptid.",
  },
  ostarine: {
    shortDescriptionDe: "Ostarine (MK-2866) ist ein nicht-steroidaler SARM aus der Muskel- und Knochen-Forschung.",
  },
  ligandrol: {
    shortDescriptionDe: "LGD-4033 (Ligandrol) ist ein nicht-steroidaler SARM aus der Muskel-Forschung.",
  },
  rad140: {
    shortDescriptionDe: "RAD-140 (Testolone) ist ein nicht-steroidaler SARM aus der Forschung.",
  },
  andarine: {
    shortDescriptionDe: "Andarine (S4) ist ein nicht-steroidaler SARM aus der Forschung.",
  },
  yk11: {
    shortDescriptionDe: "YK-11 ist ein steroidal SARM/Myostatin-Modulator aus der Forschung.",
  },
  ibutamoren: {
    shortDescriptionDe: "MK-677 (Ibutamoren) ist ein nicht-peptidischer Ghrelin-Rezeptor-Agonist (GHS-R).",
  },
  clenbuterol: {
    shortDescriptionDe:
      "Clenbuterol ist ein β2-Sympathomimetikum; in einigen Ländern als Asthma-Medikament zugelassen, kein Peptid.",
  },
  "hgh-fragment-176-191": {
    shortDescriptionDe:
      "HGH-Fragment 176–191 ist ein Fragment des Wachstumshormons – nicht identisch mit Somatropin (HGH).",
    identityNote: "HGH-Fragment ≠ Somatropin (HGH). Fragmente bleiben eigene Profile.",
  },
  tesofensine: {
    shortDescriptionDe:
      "Tesofensin ist ein triple Monoamin-Wiederaufnahmehemmer, der in Adipositas-Studien untersucht wurde.",
  },
  bpc157: {
    shortDescriptionDe: "BPC-157 (Body Protection Compound) ist ein gastroprotektives Peptid aus der Präklinik-Forschung.",
  },
};

const BLEND_COMPONENTS: Record<string, string[]> = {
  "klow-blend": ["ghk-cu", "tb-500", "bpc-157"],
  "cjc-ipamorelin-blend": ["cjc-1295", "ipamorelin"],
  "slu-pp-332-bam15-blend": ["slu-pp-332", "bam15"],
  "mast-blend": ["drostanolone-propionate", "drostanolone-enanthate"],
  nandromix: ["nandrolone-decanoate", "nandrolone-phenylpropionate"],
  trenmix: ["trenbolone-acetate", "trenbolone-enanthate"],
  sustanon: ["testosterone-propionate", "testosterone-phenylpropionate", "testosterone-isocaproate", "testosterone-decanoate"],
  supertest: ["testosterone-propionate", "testosterone-enanthate", "testosterone-cypionate"],
};

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

export function fallbackIdentityBrief(family: LexiconV2FamilyBundle): IdentityBrief {
  const name = germanDisplayNameForSlug(family.slug, family.substanceLabel);
  const kind = categoryLabel(family.category);
  return {
    shortDescriptionDe: `${name} ist im Shop-Katalog als ${kind} geführt. Für belastbare Aussagen zu Humanwirksamkeit und Sicherheit liegt derzeit keine vollständig kuratierte Quellenbasis vor.`,
    blendComponentSlugs: BLEND_COMPONENTS[family.slug],
  };
}

export function getIdentityBrief(family: LexiconV2FamilyBundle): IdentityBrief {
  const hand = HAND_CURATED_IDENTITY[family.slug];
  const fallback = fallbackIdentityBrief(family);
  if (!hand) return fallback;
  return {
    ...fallback,
    ...hand,
    blendComponentSlugs: hand.blendComponentSlugs ?? BLEND_COMPONENTS[family.slug] ?? fallback.blendComponentSlugs,
  };
}

export function partialSectionFromIdentity(field: "uses" | "benefits" | "risks" | "human" | "preclinical"): string {
  if (field === "uses") {
    return `Identität und Katalogzuordnung sind dokumentiert. ${INSUFFICIENT_DATA_DE}`;
  }
  if (field === "benefits") {
    return INSUFFICIENT_DATA_DE;
  }
  if (field === "risks") {
    return INSUFFICIENT_DATA_DE;
  }
  if (field === "human") {
    return "Humane Studienlage: noch nicht vollständig kuratiert. " + INSUFFICIENT_DATA_DE;
  }
  return "Präklinische Forschung: noch nicht vollständig kuratiert. " + INSUFFICIENT_DATA_DE;
}

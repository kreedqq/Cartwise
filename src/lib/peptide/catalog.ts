import { applyPublishedProfile } from "@/lib/peptide/profiles";
import type { PeptideCategory, PeptideSubstance } from "@/lib/peptide/types";

function substance(
  slug: string,
  name: string,
  aliases: string[],
  category: PeptideCategory,
  extra: Partial<Pick<PeptideSubstance, "developmentNames" | "identityNote" | "blendComponentSlugs" | "moleculeType">> = {},
): PeptideSubstance {
  return {
    id: slug,
    slug,
    name,
    displayName: name,
    aliases,
    developmentNames: extra.developmentNames ?? [],
    casNumber: null,
    category,
    subcategory: null,
    moleculeType: extra.moleculeType ?? null,
    chemicalClass: null,
    description:
      "Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.",
    identityNote: extra.identityNote ?? null,
    blendComponentSlugs: extra.blendComponentSlugs ?? [],
    evidenceLevel: "F",
    confidenceLevel: "insufficient",
    regulatoryStatus: "insufficient",
    reviewStatus: "incomplete",
    lastReviewedAt: null,
    lastResearchScanAt: null,
    lastCommunityScanAt: null,
  };
}

/**
 * Identity-only catalog. No studies, approvals, doses, PK values or community quotes.
 * Evidence stays at F / insufficient until a reviewed source is attached.
 */
export const PEPTIDE_SUBSTANCES_IDENTITY: readonly PeptideSubstance[] = [
  substance("retatrutide", "Retatrutide", ["Reta", "Retatrutid"], "glp-metabolic", {
    developmentNames: ["LY3437943"],
    moleculeType: "peptide",
  }),
  substance("tirzepatide", "Tirzepatide", ["Tirzepatid", "TZP"], "glp-metabolic", {
    developmentNames: ["LY3298176"],
    moleculeType: "peptide",
  }),
  substance("semaglutide", "Semaglutide", ["Semaglutid"], "glp-metabolic", { moleculeType: "peptide" }),
  substance("liraglutide", "Liraglutide", ["Liraglutid"], "glp-metabolic", { moleculeType: "peptide" }),
  substance("cagrilintide", "Cagrilintide", [], "glp-metabolic", { moleculeType: "peptide" }),
  substance("mazdutide", "Mazdutide", [], "glp-metabolic", { moleculeType: "peptide" }),
  substance("orforglipron", "Orforglipron", [], "glp-metabolic", { moleculeType: "research-compounds" }),
  substance("tesamorelin", "Tesamorelin", [], "growth-hormone", { moleculeType: "peptide" }),
  substance("cjc-1295", "CJC-1295", ["CJC1295", "CJC 1295"], "growth-hormone", { moleculeType: "peptide" }),
  substance("ipamorelin", "Ipamorelin", ["IPA"], "growth-hormone", { moleculeType: "peptide" }),
  substance("sermorelin", "Sermorelin", [], "growth-hormone", { moleculeType: "peptide" }),
  substance("ghk-cu", "GHK-Cu", ["GHK", "Copper peptide"], "cosmetic", { moleculeType: "peptide" }),
  substance("bpc-157", "BPC-157", ["BPC157", "Body Protection Compound 157"], "recovery", { moleculeType: "peptide" }),
  substance("tb-500", "TB-500", ["TB500"], "recovery", {
    identityNote:
      "TB-500 wird nicht automatisch mit vollständigem Thymosin Beta-4 gleichgesetzt. Die Identität bleibt getrennt, bis eine geprüfte Quelle die Zuordnung bestätigt.",
    moleculeType: "peptide",
  }),
  substance("thymosin-beta-4", "Thymosin Beta-4", ["Tβ4", "TMSB4"], "recovery", {
    identityNote: "Vollständiges Thymosin Beta-4. Nicht automatisch identisch mit TB-500.",
    moleculeType: "peptide",
  }),
  substance("mots-c", "MOTS-C", ["MOTS-c", "MOTSC"], "longevity", { moleculeType: "peptide" }),
  substance("aod-9604", "AOD-9604", ["AOD9604"], "glp-metabolic", { moleculeType: "peptide" }),
  substance("semax", "Semax", [], "cognitive", { moleculeType: "peptide" }),
  substance("selank", "Selank", [], "cognitive", { moleculeType: "peptide" }),
  substance("thymosin-alpha-1", "Thymosin Alpha-1", ["Tα1", "Thymalfasin"], "immune", { moleculeType: "peptide" }),
  substance("kpv", "KPV", [], "immune", { moleculeType: "peptide" }),
  substance("igf-1-lr3", "IGF-1 LR3", ["IGF1 LR3", "Long R3 IGF-1"], "growth-hormone", { moleculeType: "peptide" }),
  substance("somatropin", "Somatropin", ["HGH", "rhGH"], "growth-hormone", { moleculeType: "peptide" }),
  substance("hcg", "Human Chorionic Gonadotropin", ["HCG"], "hormones", { moleculeType: "biologics" }),
  substance("gonadorelin", "Gonadorelin", ["GnRH"], "hormones", { moleculeType: "peptide" }),
  substance("melanotan-ii", "Melanotan II", ["MT-2", "MT2", "Melanotan"], "cosmetic", { moleculeType: "peptide" }),
  substance("glow-blend", "GHK-Cu + TB-500 + BPC-157", ["GLOW", "Glow Blend"], "recovery", {
    blendComponentSlugs: ["ghk-cu", "tb-500", "bpc-157"],
    moleculeType: "blend",
  }),
];

export const PEPTIDE_SUBSTANCES: readonly PeptideSubstance[] = PEPTIDE_SUBSTANCES_IDENTITY.map(applyPublishedProfile);

const BY_SLUG = new Map(PEPTIDE_SUBSTANCES.map((item) => [item.slug, item]));

export function getSubstanceBySlug(slug: string): PeptideSubstance | undefined {
  return BY_SLUG.get(slug);
}

export function getIdentitySubstance(slug: string): PeptideSubstance | undefined {
  return PEPTIDE_SUBSTANCES_IDENTITY.find((item) => item.slug === slug);
}

export const CATEGORY_LABELS: Record<PeptideCategory, string> = {
  peptides: "Peptides",
  "glp-metabolic": "GLP / Metabolic",
  "growth-hormone": "Growth Hormone",
  recovery: "Recovery",
  longevity: "Longevity",
  cognitive: "Cognitive",
  cosmetic: "Cosmetic",
  immune: "Immune",
  hormones: "Hormones",
  biologics: "Biologics",
  sarms: "SARMs",
  "anabolic-steroids": "Anabolic Steroids",
  orals: "Orals",
  "injectables-oils": "Injectables / Oils",
  "research-compounds": "Research Compounds",
};

export const REGULATORY_LABELS = {
  approved: "Approved",
  "approved-specific": "Approved for specific indication",
  "clinical-development": "Clinical development",
  investigational: "Investigational",
  "not-approved": "Not approved",
  insufficient: "Insufficient regulatory information",
  unknown: "Unknown",
} as const;

export const EVIDENCE_LABELS = {
  A: "Zugelassene Anwendung / starke Human-Evidenz",
  B: "Gute Human-Evidenz",
  C: "Begrenzte Human-Evidenz",
  D: "Überwiegend präklinische Evidenz",
  E: "Sehr begrenzte Daten",
  F: "Keine ausreichenden belastbaren Human-Sicherheitsdaten",
} as const;

export const SAFETY_DISCLAIMER =
  "Diese Datenbank dient der wissenschaftlichen Information und ersetzt keine medizinische Beratung. Bei nicht zugelassenen oder experimentellen Substanzen können Wirksamkeit, Reinheit, Dosierung und Langzeitsicherheit unzureichend untersucht sein.";

export const COMMUNITY_DISCLAIMER =
  "Nutzerberichte sind anekdotische Erfahrungswerte und belegen weder Wirksamkeit noch Sicherheit, Kausalität oder Häufigkeit.";

export const NO_DATA = "Keine ausreichenden belastbaren Daten gefunden.";
export const NO_RECONSTITUTION =
  "Keine standardisierte regulatorisch validierte Rekonstitutionsanweisung identifiziert.";
export const NO_STANDARD_DOSE =
  "Keine etablierte medizinische Standarddosierung aus zugelassenen Fachinformationen identifiziert.";

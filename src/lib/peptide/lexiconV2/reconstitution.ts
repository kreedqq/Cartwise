import type {
  ReconstitutionProductRule,
  ReconstitutionProfileData,
  ReconstitutionVialOption,
} from "@/lib/peptide/lexiconV2/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

export const DEFAULT_MG_PER_ML = 10;

export const CALCULATOR_DISCLAIMER_DE =
  "Rechnerisches Ergebnis auf Basis der hinterlegten Shop-Produktregel. Keine individuelle medizinische Dosierungsanweisung.";

const FIXED_3ML_BAC_SLUGS = new Set(["ghk-cu", "glow-blend", "klow-blend"]);

export function reconstitutionRuleForSlug(slug: string): ReconstitutionProductRule {
  if (FIXED_3ML_BAC_SLUGS.has(slug)) {
    return {
      slug,
      solventType: "bac-water",
      ruleKind: "fixed-volume",
      fixedVolumeMl: 3,
      disclaimerDe: CALCULATOR_DISCLAIMER_DE,
    };
  }
  return {
    slug,
    solventType: "bac-water",
    ruleKind: "linear-mg-per-ml",
    mgPerMl: DEFAULT_MG_PER_ML,
    disclaimerDe: CALCULATOR_DISCLAIMER_DE,
  };
}

export function reconstitutionApplicable(category: ShopCoverageCategory, slug: string): boolean {
  if (category === "HILFSSTOFFE" || category === "ORALS" || category === "OILS / INJECTABLES") return false;
  if (slug === "bac-water" || slug === "aa-water") return false;
  return category === "PEPTIDES" || category === "BLENDS" || category === "SONSTIGE";
}

/** Solvent volume (ml) from vial mass using the operator rule. */
export function solventVolumeMl(vialMg: number, rule: ReconstitutionProductRule): number | null {
  if (!Number.isFinite(vialMg) || vialMg <= 0) return null;
  if (rule.ruleKind === "fixed-volume") return rule.fixedVolumeMl ?? null;
  const mgPerMl = rule.mgPerMl ?? DEFAULT_MG_PER_ML;
  if (mgPerMl <= 0) return null;
  return vialMg / mgPerMl;
}

function parseMgFromLabel(label: string): number | null {
  const mg = /(\d+(?:[.,]\d+)?)\s*mg/i.exec(label);
  if (mg) {
    const value = Number(mg[1].replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const mcg = /(\d+(?:[.,]\d+)?)\s*mcg/i.exec(label);
  if (mcg) {
    const value = Number(mcg[1].replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value / 1000 : null;
  }
  return null;
}

/** Hide internal SKU-style variant codes in public vial selectors. */
function publicVialLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—") return trimmed;

  const mgMatch = /(\d+(?:[.,]\d+)?)\s*mg/i.exec(trimmed);
  if (mgMatch) return `${mgMatch[1].replace(",", ".")} mg`;

  const mcgMatch = /(\d+(?:[.,]\d+)?)\s*mcg/i.exec(trimmed);
  if (mcgMatch) return `${mcgMatch[1].replace(",", ".")} mcg`;

  const iuMatch = /(\d+(?:[.,]\d+)?)\s*(?:iu|ui)/i.exec(trimmed);
  if (iuMatch) return `${iuMatch[1].replace(",", ".")} IU`;

  if (/^[A-Z]{2,}\d+$/i.test(trimmed)) {
    return trimmed.replace(/^[A-Z]+/i, "").trim() || trimmed;
  }

  return trimmed;
}

export function vialOptionsFromLabels(labels: string[]): ReconstitutionVialOption[] {
  const seen = new Set<string>();
  const options: ReconstitutionVialOption[] = [];
  for (const raw of labels) {
    const label = publicVialLabel(raw);
    if (!label || label === "—" || seen.has(label)) continue;
    seen.add(label);
    const mg = parseMgFromLabel(raw);
    const mcgMatch = /(\d+(?:[.,]\d+)?)\s*mcg/i.exec(raw);
    options.push({
      label,
      amountMg: mg,
      amountMcg: mcgMatch ? Number(mcgMatch[1].replace(",", ".")) : null,
    });
  }
  return options.sort((a, b) => (a.amountMg ?? 0) - (b.amountMg ?? 0));
}

export function buildReconstitutionProfile(
  slug: string,
  category: ShopCoverageCategory,
  vialLabels: string[],
): ReconstitutionProfileData | null {
  if (!reconstitutionApplicable(category, slug)) return null;

  const rule = reconstitutionRuleForSlug(slug);
  const vialOptions = vialOptionsFromLabels(vialLabels);

  const ruleNote =
    rule.ruleKind === "fixed-volume"
      ? `Shop-Produktregel: ${rule.fixedVolumeMl} ml BAC Water (fix).`
      : `Shop-Produktregel: ${rule.mgPerMl ?? DEFAULT_MG_PER_ML} mg → 1 ml BAC Water (linear skaliert).`;

  return {
    applicable: true,
    rule,
    vialOptions,
    noteDe: `${ruleNote} Als rechnerische Produktinformation gekennzeichnet – keine individuelle medizinische Dosierungsanweisung.`,
    calculatorDisclaimerDe: CALCULATOR_DISCLAIMER_DE,
  };
}

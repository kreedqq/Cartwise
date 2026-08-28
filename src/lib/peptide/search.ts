import { PEPTIDE_SUBSTANCES } from "@/lib/peptide/catalog";
import { matchesLexiconCategory } from "@/lib/peptide/lexiconFilters";
import type { PeptideCategory, PeptideSubstance } from "@/lib/peptide/types";

/** Search fields from the dual-read spec: name, alias, development name, CAS, slug. */
export type SubstanceSearchFields = {
  name: string;
  displayName: string;
  aliases: readonly string[];
  developmentNames: readonly string[];
  slug: string;
  category: PeptideCategory | string;
  casNumber?: string | null;
};

export function substanceSearchHaystack(substance: SubstanceSearchFields): string {
  return [
    substance.name,
    substance.displayName,
    ...substance.aliases,
    ...substance.developmentNames,
    substance.slug,
    substance.casNumber ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function matchesSubstanceSearch(
  substance: SubstanceSearchFields,
  query: string,
  category: PeptideCategory | "all" = "all",
): boolean {
  if (!matchesLexiconCategory(substance, category)) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return substanceSearchHaystack(substance).includes(needle);
}

export function searchLexiconSubstances(
  items: readonly PeptideSubstance[],
  query: string,
  category: PeptideCategory | "all" = "all",
): PeptideSubstance[] {
  return items.filter((item) => matchesSubstanceSearch(item, query, category));
}

export function searchSubstances(query: string, category: PeptideCategory | "all" = "all"): PeptideSubstance[] {
  return searchLexiconSubstances(PEPTIDE_SUBSTANCES, query, category);
}

export const PRODUCT_CODE_PREFIX_RULES: Array<{ test: RegExp; slug: string }> = [
  { test: /^RT\d+/i, slug: "retatrutide" },
  { test: /^TZ\d+/i, slug: "tirzepatide" },
  { test: /^SM\d+/i, slug: "semaglutide" },
  { test: /^LR\d+/i, slug: "liraglutide" },
  { test: /^CJC/i, slug: "cjc-1295" },
  { test: /^IPA/i, slug: "ipamorelin" },
  { test: /^BPC/i, slug: "bpc-157" },
  { test: /^TB5/i, slug: "tb-500" },
  { test: /^GHK/i, slug: "ghk-cu" },
  { test: /^MOT/i, slug: "mots-c" },
  { test: /^AOD/i, slug: "aod-9604" },
  { test: /^MT2?/i, slug: "melanotan-ii" },
  { test: /^KPV/i, slug: "kpv" },
  { test: /^IGF/i, slug: "igf-1-lr3" },
];

export function substanceSlugForProduct(product: { code?: string | null; name?: string | null }): string | null {
  const code = (product.code ?? "").trim();
  for (const rule of PRODUCT_CODE_PREFIX_RULES) {
    if (rule.test.test(code)) return rule.slug;
  }
  const name = (product.name ?? "").toLowerCase();
  if (name.includes("ghk") && name.includes("tb") && name.includes("bpc")) return "glow-blend";
  const hit = PEPTIDE_SUBSTANCES.find((item) => {
    const keys = [item.name, ...item.aliases, ...item.developmentNames].map((v) => v.toLowerCase());
    return keys.some((key) => key.length >= 4 && name.includes(key));
  });
  return hit?.slug ?? null;
}

export function parseStrengthLabel(name: string | null | undefined): string | null {
  const match = (name ?? "").match(/(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|iu|ml)\b/i);
  if (!match) return null;
  return `${match[1].replace(",", ".")} ${match[2].toLowerCase().replace("µg", "mcg").replace("ug", "mcg")}`;
}

export function parseMgStrength(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/^(\d+(?:\.\d+)?)\s*mg$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

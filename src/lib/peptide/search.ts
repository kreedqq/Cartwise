import { CATEGORY_LABELS, PEPTIDE_SUBSTANCES } from "@/lib/peptide/catalog";
import type { PeptideCategory, PeptideSubstance } from "@/lib/peptide/types";

function haystack(substance: PeptideSubstance): string {
  return [
    substance.name,
    substance.displayName,
    ...substance.aliases,
    ...substance.developmentNames,
    substance.slug,
    substance.category,
    CATEGORY_LABELS[substance.category],
    substance.moleculeType ?? "",
    substance.identityNote ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function searchSubstances(query: string, category: PeptideCategory | "all" = "all"): PeptideSubstance[] {
  const needle = query.trim().toLowerCase();
  return PEPTIDE_SUBSTANCES.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!needle) return true;
    return haystack(item).includes(needle);
  });
}

const CODE_PREFIX: Array<{ test: RegExp; slug: string }> = [
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
  for (const rule of CODE_PREFIX) {
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

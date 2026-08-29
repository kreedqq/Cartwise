import { pendingFamiliesFromShop } from "@/lib/peptide/lexiconV2/families";
import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

/** Families with unclear identity — excluded from automatic lexicon-wide research runs. */
function excludedFromAutoUpdateSlugs(): ReadonlySet<string> {
  return new Set(
    pendingFamiliesFromShop()
      .filter((family) => family.status === "REVIEW_REQUIRED" || family.status === "UNKNOWN")
      .map((family) => family.slug),
  );
}

export function lexiconUpdatableSlugs(): string[] {
  const excluded = excludedFromAutoUpdateSlugs();
  const catalog = buildPublicLexiconV2Catalog();
  return catalog.entries
    .map((entry) => entry.slug)
    .filter((slug) => !excluded.has(slug))
    .sort((left, right) => left.localeCompare(right));
}

export function lexiconUpdatableSlugsByCategory(category: ShopCoverageCategory): string[] {
  const excluded = excludedFromAutoUpdateSlugs();
  const catalog = buildPublicLexiconV2Catalog();
  return catalog.entries
    .filter((entry) => entry.category === category && !excluded.has(entry.slug))
    .map((entry) => entry.slug)
    .sort((left, right) => left.localeCompare(right));
}

export function lexiconUpdateProfileCount(): number {
  return lexiconUpdatableSlugs().length;
}

export function isLexiconUpdatableSlug(slug: string): boolean {
  return lexiconUpdatableSlugs().includes(slug);
}

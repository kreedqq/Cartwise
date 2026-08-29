import { getPublishedProfile, listPublishedProfiles } from "@/lib/peptide/profiles";
import { shopCoverageMatrix } from "@/lib/peptide/shopCoverage/coverage";
import type {
  LexiconV2FamilyBundle,
  LexiconV2PendingFamily,
} from "@/lib/peptide/lexiconV2/types";

const PUBLISHED_SLUGS = new Set(listPublishedProfiles().map((profile) => profile.slug));

export function publishedLexiconSlugs(): ReadonlySet<string> {
  return PUBLISHED_SLUGS;
}

export function hasPublishedLexiconProfile(slug: string): boolean {
  return Boolean(getPublishedProfile(slug));
}

/** Uniquely identified PARTIAL families that still need a draft Lexikon 2.0 profile. */
export function draftFamiliesFromShop(): LexiconV2FamilyBundle[] {
  const rows = shopCoverageMatrix();
  const bySlug = new Map<string, LexiconV2FamilyBundle>();

  for (const row of rows) {
    if (row.status !== "PARTIAL" || !row.familySlug) continue;
    if (PUBLISHED_SLUGS.has(row.familySlug)) continue;

    const existing = bySlug.get(row.familySlug);
    if (existing) {
      if (!existing.shopProductNames.includes(row.name)) existing.shopProductNames.push(row.name);
      if (!existing.vialLabels.includes(row.variant)) existing.vialLabels.push(row.variant);
      continue;
    }

    bySlug.set(row.familySlug, {
      slug: row.familySlug,
      category: row.coverageCategory,
      substanceLabel: row.substance,
      shopProductNames: [row.name],
      vialLabels: [row.variant],
    });
  }

  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export function pendingFamiliesFromShop(): LexiconV2PendingFamily[] {
  const rows = shopCoverageMatrix();
  const bySlug = new Map<string, LexiconV2PendingFamily>();

  for (const row of rows) {
    if (row.status !== "REVIEW_REQUIRED" && row.status !== "UNKNOWN") continue;
    if (!row.familySlug) continue;

    const existing = bySlug.get(row.familySlug);
    if (existing) {
      if (!existing.shopProductNames.includes(row.name)) existing.shopProductNames.push(row.name);
      continue;
    }

    bySlug.set(row.familySlug, {
      slug: row.familySlug,
      category: row.coverageCategory,
      status: row.status,
      reason: row.reason,
      shopProductNames: [row.name],
    });
  }

  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export function nonLexiconProductCount(): number {
  return shopCoverageMatrix().filter((row) => row.status === "NON_LEXICON").length;
}

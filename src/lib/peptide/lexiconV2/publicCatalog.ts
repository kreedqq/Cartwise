import { listPublishedProfiles } from "@/lib/peptide/profiles";
import { draftFamiliesFromShop, pendingFamiliesFromShop } from "@/lib/peptide/lexiconV2/families";
import { mapDraftProfileToEntry } from "@/lib/peptide/lexiconV2/mapDraftEntry";
import { mapPublishedProfileToEntry } from "@/lib/peptide/lexiconV2/mapPublishedEntry";
import type { PublicLexiconEntry, PublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicTypes";
import { LEXICON_V2_DRAFT_PROFILES } from "@/lib/peptide/lexiconV2/catalog";
import { shopCoverageMatrix } from "@/lib/peptide/shopCoverage/coverage";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";
import { enrichEntryBenefits } from "@/lib/peptide/lexiconV2/contentEngine/benefits";

function buildCategoryAndVialsMaps() {
  const categoryBySlug = new Map<string, ShopCoverageCategory>();
  const vialsBySlug = new Map<string, string[]>();

  for (const row of shopCoverageMatrix()) {
    if (!row.familySlug) continue;
    if (!categoryBySlug.has(row.familySlug)) {
      categoryBySlug.set(row.familySlug, row.coverageCategory);
    }
    const vials = vialsBySlug.get(row.familySlug) ?? [];
    if (row.variant && row.variant !== "—" && !vials.includes(row.variant)) {
      vials.push(row.variant);
    }
    vialsBySlug.set(row.familySlug, vials);
  }

  return { categoryBySlug, vialsBySlug };
}

function buildFamilySearchTerms() {
  const termsBySlug = new Map<string, string[]>();
  for (const family of draftFamiliesFromShop()) {
    termsBySlug.set(family.slug, family.shopProductNames);
  }
  return termsBySlug;
}

export function buildPublicLexiconV2Catalog(): PublicLexiconV2Catalog {
  const { categoryBySlug, vialsBySlug } = buildCategoryAndVialsMaps();
  const familyNames = buildFamilySearchTerms();
  const entries: PublicLexiconEntry[] = [];

  for (const profile of listPublishedProfiles()) {
    const category = categoryBySlug.get(profile.slug) ?? "PEPTIDES";
    entries.push(
      mapPublishedProfileToEntry(profile, category, vialsBySlug.get(profile.slug) ?? []),
    );
  }

  for (const draft of LEXICON_V2_DRAFT_PROFILES) {
    entries.push(mapDraftProfileToEntry(draft, familyNames.get(draft.slug) ?? []));
  }

  entries.sort((a, b) => a.displayNameDe.localeCompare(b.displayNameDe, "de"));

  const enrichedEntries = entries.map((entry) => enrichEntryBenefits(entry));

  const pending = pendingFamiliesFromShop();

  return {
    entries: enrichedEntries,
    bySlug: new Map(enrichedEntries.map((entry) => [entry.slug, entry])),
    publishedCount: enrichedEntries.filter((entry) => entry.publicationStatus === "published").length,
    draftCount: enrichedEntries.filter((entry) => entry.publicationStatus === "draft").length,
    reviewRequiredFamilies: pending.filter((item) => item.status === "REVIEW_REQUIRED").length,
    unknownFamilies: pending.filter((item) => item.status === "UNKNOWN").length,
  };
}

export function getPublicLexiconEntry(slug: string, catalog = buildPublicLexiconV2Catalog()): PublicLexiconEntry | undefined {
  return catalog.bySlug.get(slug);
}

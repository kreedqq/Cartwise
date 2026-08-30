import { listPublishedProfiles } from "@/lib/peptide/profiles";
import { draftFamiliesFromShop, pendingFamiliesFromShop } from "@/lib/peptide/lexiconV2/families";
import { mapDraftProfileToEntry } from "@/lib/peptide/lexiconV2/mapDraftEntry";
import { mapPublishedProfileToEntry } from "@/lib/peptide/lexiconV2/mapPublishedEntry";
import { mapPdfProfileToEntry, overlayPdfProfileOnEntry } from "@/lib/peptide/lexiconV2/mapPdfProfileToEntry";
import { listPdfResearchProfiles } from "@/lib/peptide/lexiconV2/pdfResearch";
import { slugForPdfProfileName } from "@/lib/peptide/lexiconV2/pdfResearch/slugMap";
import type { PublicLexiconEntry, PublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicTypes";
import { LEXICON_V2_DRAFT_PROFILES } from "@/lib/peptide/lexiconV2/catalog";
import { EXACT_NAME_GROUPS, normalizeCatalogName } from "@/lib/peptide/shopCoverage/names";
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

function buildFamilySlugToPdfSlug(pdfProfileNames: Set<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of EXACT_NAME_GROUPS) {
    for (const name of group.names) {
      if (pdfProfileNames.has(normalizeCatalogName(name))) {
        map.set(group.slug, slugForPdfProfileName(name));
      }
    }
  }
  return map;
}

export function buildPublicLexiconV2Catalog(): PublicLexiconV2Catalog {
  const { categoryBySlug, vialsBySlug } = buildCategoryAndVialsMaps();
  const familyNames = buildFamilySearchTerms();
  const pdfProfiles = listPdfResearchProfiles();
  const pdfNameSet = new Set(pdfProfiles.map((p) => normalizeCatalogName(p.name)));
  const familyToPdfSlug = buildFamilySlugToPdfSlug(pdfNameSet);
  const pdfBackedFamilySlugs = new Set(familyToPdfSlug.keys());
  const entriesBySlug = new Map<string, PublicLexiconEntry>();

  for (const pdfProfile of pdfProfiles) {
    entriesBySlug.set(slugForPdfProfileName(pdfProfile.name), mapPdfProfileToEntry(pdfProfile));
  }

  for (const profile of listPublishedProfiles()) {
    if (pdfBackedFamilySlugs.has(profile.slug)) {
      const pdfSlug = familyToPdfSlug.get(profile.slug)!;
      const pdfProfile = pdfProfiles.find((p) => slugForPdfProfileName(p.name) === pdfSlug);
      const publishedEntry = mapPublishedProfileToEntry(
        profile,
        categoryBySlug.get(profile.slug) ?? "PEPTIDES",
        vialsBySlug.get(profile.slug) ?? [],
      );
      if (pdfProfile) {
        entriesBySlug.set(pdfSlug, overlayPdfProfileOnEntry(publishedEntry, pdfProfile));
      }
      continue;
    }
    if (!entriesBySlug.has(profile.slug)) {
      entriesBySlug.set(
        profile.slug,
        mapPublishedProfileToEntry(profile, categoryBySlug.get(profile.slug) ?? "PEPTIDES", vialsBySlug.get(profile.slug) ?? []),
      );
    }
  }

  for (const draft of LEXICON_V2_DRAFT_PROFILES) {
    if (pdfBackedFamilySlugs.has(draft.slug)) continue;
    if (!entriesBySlug.has(draft.slug)) {
      entriesBySlug.set(draft.slug, mapDraftProfileToEntry(draft, familyNames.get(draft.slug) ?? []));
    }
  }

  for (const [familySlug, pdfSlug] of familyToPdfSlug) {
    const entry = entriesBySlug.get(pdfSlug);
    if (entry) entriesBySlug.set(familySlug, entry);
  }

  const canonicalEntries = [...new Set(entriesBySlug.values())];
  canonicalEntries.sort((a, b) => a.displayNameDe.localeCompare(b.displayNameDe, "de"));

  const enrichedEntries = canonicalEntries.map((entry) => (entry.pdfEvidenceGrade ? entry : enrichEntryBenefits(entry)));

  const bySlug = new Map<string, PublicLexiconEntry>();
  for (const [slug, entry] of entriesBySlug) {
    const enriched = enrichedEntries.find((e) => e === entry) ?? entry;
    bySlug.set(slug, enriched);
  }

  const pending = pendingFamiliesFromShop();

  return {
    entries: enrichedEntries,
    bySlug,
    publishedCount: enrichedEntries.filter((entry) => entry.publicationStatus === "published").length,
    draftCount: enrichedEntries.filter((entry) => entry.publicationStatus === "draft").length,
    reviewRequiredFamilies: pending.filter((item) => item.status === "REVIEW_REQUIRED").length,
    unknownFamilies: pending.filter((item) => item.status === "UNKNOWN").length,
  };
}

export function getPublicLexiconEntry(slug: string, catalog = buildPublicLexiconV2Catalog()): PublicLexiconEntry | undefined {
  return catalog.bySlug.get(slug);
}

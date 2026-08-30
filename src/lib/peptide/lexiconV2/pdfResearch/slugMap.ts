import { slugifyCatalogName } from "@/lib/peptide/shopCoverage/names";
import type { PdfResearchProfile } from "@/lib/peptide/lexiconV2/pdfResearch/types";

/** One lexicon slug per PDF profile name (201 profiles → ~193 unique slugs when names repeat). */
export function slugForPdfProfileName(name: string): string {
  return slugifyCatalogName(name);
}

export function buildPdfProfileSlugIndex(profiles: PdfResearchProfile[]): Map<string, PdfResearchProfile> {
  const bySlug = new Map<string, PdfResearchProfile>();
  for (const profile of profiles) {
    bySlug.set(slugForPdfProfileName(profile.name), profile);
  }
  return bySlug;
}

/** Resolve shop family slug to a PDF-backed lexicon slug when names differ. */
export function resolveLexiconSlugForShopFamily(familySlug: string, catalogNames: string[]): string {
  if (catalogNames.length === 1) {
    return slugForPdfProfileName(catalogNames[0]);
  }
  return familySlug;
}

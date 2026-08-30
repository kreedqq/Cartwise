import { describe, expect, it } from "vitest";

import {
  buildCommunitySearchLinks,
  communitySearchTermsForProfile,
} from "@/lib/peptide/lexiconV2/communitySearch";
import { getCuratedContentPack } from "@/lib/peptide/lexiconV2/contentEngine/curated";
import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import { buildReconstitutionProfile } from "@/lib/peptide/lexiconV2/reconstitution";
import { searchLexiconV2Entries } from "@/lib/peptide/lexiconV2/search";
import { lexiconUpdateProfileCount, lexiconUpdatableSlugsByCategory } from "@/lib/peptide/research/updateEngine";
import { postgresMappingSlug } from "@/lib/peptide/persistence/sqlProductMapping";
import { substanceSlugForProduct } from "@/lib/peptide/search";
import { coverageRowForProduct, shopCoverageMatrix } from "@/lib/peptide/shopCoverage/coverage";
import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import { loadShopCatalogProducts } from "@/lib/peptide/shopCoverage/loadProducts";

const KLOW_PRODUCT = loadShopCatalogProducts().find((row) => row.code === "KL80")!;
const KLOW_COVERAGE = shopCoverageMatrix().find((row) => row.code === "KL80")!;

describe("KLOW blend public lexicon profile", () => {
  it("maps KL80 to klow-blend without exposing SKU in public profile text", () => {
    expect(postgresMappingSlug(KLOW_PRODUCT)).toBe("klow-blend");
    expect(substanceSlugForProduct({ code: KLOW_PRODUCT.code, name: KLOW_PRODUCT.name })).toBe("klow-blend");
    expect(coverageRowForProduct(KLOW_PRODUCT).familySlug).toBe("klow-blend");
    expect(KLOW_COVERAGE.status).toBe("PARTIAL");
    expect(KLOW_COVERAGE.familySlug).toBe("klow-blend");
  });

  it("is public, searchable, categorized as BLENDS, and in update scope", () => {
    const catalog = buildPublicLexiconV2Catalog();
    expect(catalog.entries.length).toBeGreaterThanOrEqual(190);
    expect(catalog.bySlug.has("klow-blend")).toBe(true);

    const entry = catalog.bySlug.get("klow-blend")!;
    expect(entry.category).toBe("BLENDS");
    expect(entry.displayNameDe).toBe("KLOW Blend");
    expect(entry.blendComponentSlugs).toEqual(["ghk-cu", "tb-500", "bpc-157"]);
    expect(entry.shortDescriptionDe).toMatch(/KLOW/i);
    expect(entry.shortDescriptionDe).not.toMatch(/KL80/);

    const searchHits = searchLexiconV2Entries(catalog.entries, "KLOW");
    expect(searchHits.filter((row) => row.slug === "klow-blend")).toHaveLength(1);

    expect(lexiconUpdateProfileCount()).toBeGreaterThanOrEqual(185);
    expect(lexiconUpdatableSlugsByCategory("BLENDS")).toContain("klow-blend");
  });

  it("uses 3 ml BAC Water reconstitution rule", () => {
    const recon = buildReconstitutionProfile("klow-blend", "BLENDS", ["80 mg"]);
    expect(recon?.rule?.ruleKind).toBe("fixed-volume");
    expect(recon?.rule?.fixedVolumeMl).toBe(3);
    expect(recon?.noteDe).toMatch(/3 ml BAC Water/i);
    expect(recon?.calculatorDisclaimerDe).toMatch(/Keine individuelle medizinische Dosierungsanweisung/i);

    const catalog = buildPublicLexiconV2Catalog();
    const entry = catalog.bySlug.get("klow-blend")!;
    expect(entry.reconstitution?.rule?.fixedVolumeMl).toBe(3);
  });

  it("provides component-aware benefits without blend-specific clinical claims", () => {
    const catalog = buildPublicLexiconV2Catalog();
    const entry = catalog.bySlug.get("klow-blend")!;
    expect(entry.possibleBenefitsDe).toMatch(/GHK-Cu|TB-500|BPC-157/i);
    expect(entry.possibleBenefitsDe).toMatch(/nicht entsprechend klinisch untersucht|nicht automatisch auf die Mischung/i);
    expect(entry.possibleBenefitsDe).not.toMatch(/Keine Vorteile bekannt/i);
  });

  it("includes community search terms without fake posts", () => {
    const catalog = buildPublicLexiconV2Catalog();
    const entry = catalog.bySlug.get("klow-blend")!;
    const terms = communitySearchTermsForProfile({
      slug: entry.slug,
      displayNameDe: entry.displayNameDe,
      searchTerms: entry.searchTerms,
    });
    expect(terms.primary.toLowerCase()).toContain("klow");
    expect(terms.alternates.join(" ").toLowerCase()).toMatch(/klow/);
    const links = buildCommunitySearchLinks(terms);
    expect(links.some((link) => link.url.includes("reddit.com/search"))).toBe(true);
    expect(links.every((link) => link.url.startsWith("https://"))).toBe(true);
  });

  it("has curated German section content and stays separate from GLOW", () => {
    const pack = getCuratedContentPack("klow-blend");
    expect(pack).toBeDefined();
    expect(pack!.identityNote).toMatch(/nicht identisch mit GLOW/i);
    expect(pack!.usesAndResearchDe).toMatch(/Einzelkomponenten/i);
    expect(pack!.usesAndResearchDe).toMatch(/nicht entsprechend klinisch untersucht/i);

    const catalog = buildPublicLexiconV2Catalog();
    const glow = catalog.bySlug.get("glow-blend");
    const klow = catalog.bySlug.get("klow-blend");
    expect(glow?.slug).not.toBe(klow?.slug);
    expect(klow?.identityNote).toMatch(/GLOW/i);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildLexiconV2CoverageReport,
  getLexiconV2DraftProfile,
  hasLexiconV2Profile,
  listLexiconV2DraftProfiles,
  listLexiconV2DraftSlugs,
} from "@/lib/peptide/lexiconV2";
import { draftFamiliesFromShop, pendingFamiliesFromShop } from "@/lib/peptide/lexiconV2/families";
import { DEFAULT_MG_PER_ML, reconstitutionRuleForSlug, solventVolumeMl } from "@/lib/peptide/lexiconV2/reconstitution";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import { searchLexiconV2Entries } from "@/lib/peptide/lexiconV2/search";
import { shopCoverageMatrix } from "@/lib/peptide/shopCoverage/coverage";

describe("Lexikon 2.0 draft profiles", () => {
  it("creates one draft profile per uniquely identified PARTIAL family", () => {
    const drafts = listLexiconV2DraftProfiles();
    const families = draftFamiliesFromShop();
    expect(drafts).toHaveLength(families.length);
    expect(drafts.length).toBeGreaterThan(120);
    expect(new Set(drafts.map((p) => p.slug)).size).toBe(drafts.length);
  });

  it("does not create profiles for REVIEW_REQUIRED or UNKNOWN families", () => {
    const pending = pendingFamiliesFromShop();
    const draftSlugs = new Set(listLexiconV2DraftSlugs());
    for (const item of pending) {
      expect(draftSlugs.has(item.slug)).toBe(false);
    }
    expect(pending.filter((p) => p.status === "REVIEW_REQUIRED")).toHaveLength(12);
    expect(pending.filter((p) => p.status === "UNKNOWN")).toHaveLength(7);
  });

  it("keeps identity-unsafe TB-500/TB4 mix out of draft profiles", () => {
    expect(getLexiconV2DraftProfile("tb-500-tb4-mix")).toBeUndefined();
    const rows = shopCoverageMatrix().filter((row) => row.code.startsWith("BT"));
    expect(rows.every((row) => row.status === "REVIEW_REQUIRED")).toBe(true);
  });

  it("uses German skeleton text without invented sources for uncurated drafts", () => {
    const profile = getLexiconV2DraftProfile("bronchogen");
    expect(profile).toBeDefined();
    expect(profile?.publicationStatus).toBe("draft");
    expect(profile?.evidenceLevel).toBe("F");
    expect(profile?.sources).toEqual([]);
    expect(profile?.community.separatedFromScience).toBe(true);
    expect(profile?.community.available).toBe(false);
    expect(profile?.shortDescriptionDe).toMatch(/Bronchogen/i);
    expect(profile?.possibleBenefitsDe.sourceIds).toEqual([]);
  });

  it("applies reconstitution product rules", () => {
    const ghk = reconstitutionRuleForSlug("ghk-cu");
    expect(ghk?.ruleKind).toBe("fixed-volume");
    expect(ghk?.fixedVolumeMl).toBe(3);

    const defaultRule = reconstitutionRuleForSlug("ss-31");
    expect(defaultRule?.ruleKind).toBe("linear-mg-per-ml");
    expect(defaultRule?.mgPerMl).toBe(DEFAULT_MG_PER_ML);
    expect(solventVolumeMl(10, defaultRule!)).toBe(1);
    expect(solventVolumeMl(5, defaultRule!)).toBe(0.5);
  });

  it("reports coverage before and after Lexikon 2.0 data layer", () => {
    const report = buildLexiconV2CoverageReport();
    expect(report.profilesBefore).toBe(listPublishedProfiles().length);
    expect(report.profilesBefore).toBe(27);
    expect(report.newDraftProfiles).toBe(report.profilesAfter - report.profilesBefore);
    expect(report.shopSkusBefore.complete).toBe(93);
    expect(report.shopSkusAfter.withProfile).toBe(287);
    expect(report.shopSkusAfter.pending).toBe(30);
    expect(report.reviewRequiredFamilies).toBe(12);
    expect(report.unknownFamilies).toBe(7);
    expect(report.nonLexiconProducts).toBe(3);
  });

  it("marks published complete slugs as having a profile", () => {
    expect(hasLexiconV2Profile("semaglutide")).toBe(true);
    expect(hasLexiconV2Profile("tb-500-tb4-mix")).toBe(false);
  });
});

describe("Lexikon 2.0 public catalog", () => {
  it("exposes 160 public entries without REVIEW_REQUIRED or UNKNOWN families", () => {
    const catalog = buildPublicLexiconV2Catalog();
    expect(catalog.entries).toHaveLength(160);
    expect(catalog.publishedCount).toBe(27);
    expect(catalog.draftCount).toBe(133);
    expect(catalog.bySlug.has("retatrutide")).toBe(true);
    expect(catalog.bySlug.has("ss-31")).toBe(true);
    expect(catalog.bySlug.has("klow-blend")).toBe(true);
    expect(catalog.bySlug.has("tb-500-tb4-mix")).toBe(false);
  });

  it("searches by German display name and filters by category", () => {
    const catalog = buildPublicLexiconV2Catalog();
    const reta = searchLexiconV2Entries(catalog.entries, "Retatrutid");
    expect(reta.some((entry) => entry.slug === "retatrutide")).toBe(true);
    const orals = searchLexiconV2Entries(catalog.entries, "", "ORALS");
    expect(orals.length).toBeGreaterThan(0);
    expect(orals.every((entry) => entry.category === "ORALS")).toBe(true);
  });
});

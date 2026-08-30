import { describe, expect, it } from "vitest";

import { buildLexiconContentReport } from "@/lib/peptide/lexiconV2/contentEngine/report";
import { getCuratedContentPack } from "@/lib/peptide/lexiconV2/contentEngine/curated";
import { getLexiconV2DraftProfile } from "@/lib/peptide/lexiconV2/catalog";
import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import {
  benefitsCatalogCoverage,
  getBenefitsProfile,
  isGenericBenefitsText,
} from "@/lib/peptide/lexiconV2/contentEngine/benefits";
import { buildBenefitsReport } from "@/lib/peptide/lexiconV2/contentEngine/benefits/report";

describe("Lexikon 2.0 content engine", () => {
  it("assigns COMPLETE curated packs to priority draft profiles with real sources", () => {
    const ss31 = getLexiconV2DraftProfile("ss-31");
    expect(ss31?.contentStatus).toBe("COMPLETE");
    expect(ss31?.sources.some((s) => s.pmid === "33077895")).toBe(true);
    expect(ss31?.shortDescriptionDe).toMatch(/Elamipretid/i);

    const adipotide = getLexiconV2DraftProfile("adipotide");
    expect(adipotide?.contentStatus).toBe("COMPLETE");
    expect(adipotide?.sources.some((s) => s.pmid === "15133506")).toBe(true);

    const amq = getLexiconV2DraftProfile("5-amino-1mq");
    expect(amq?.contentStatus).toBe("COMPLETE");
    expect(amq?.sources.some((s) => s.pmid === "29155147")).toBe(true);
  });

  it("uses tiered benefits for bioregulator drafts instead of generic insufficient-data text", () => {
    const broncho = getLexiconV2DraftProfile("bronchogen");
    expect(broncho?.contentStatus).toBe("PARTIAL");
    expect(broncho?.shortDescriptionDe).toMatch(/Bronchogen/i);
    expect(broncho?.possibleBenefitsDe.text).toMatch(/Präklinische Hinweise/i);
    expect(broncho?.possibleBenefitsDe.text).toMatch(/Atemwegs/i);
    expect(isGenericBenefitsText(broncho?.possibleBenefitsDe.text ?? "")).toBe(false);
    expect(broncho?.sources).toEqual([]);
    expect(broncho?.usesAndResearchDe.text.length).toBeGreaterThan(50);
  });

  it("fills all public profiles with German section content", () => {
    const catalog = buildPublicLexiconV2Catalog();
    for (const entry of catalog.entries) {
      expect(entry.shortDescriptionDe.length).toBeGreaterThan(20);
      expect(entry.usesAndResearchDe.length).toBeGreaterThan(20);
      expect(entry.possibleBenefitsDe.length).toBeGreaterThan(10);
      expect(entry.possibleRisksDe.length).toBeGreaterThan(10);
      expect(entry.applicationFormDe.length).toBeGreaterThan(10);
      const studyText = entry.studyLandscape.studyStatusDe || entry.studyLandscape.humanStudiesDe;
      expect(studyText.length).toBeGreaterThan(10);
    }
  });

  it("never uses generic insufficient-data placeholder as sole benefits text", () => {
    const catalog = buildPublicLexiconV2Catalog();
    for (const entry of catalog.entries) {
      expect(isGenericBenefitsText(entry.possibleBenefitsDe)).toBe(false);
    }
  });

  it("provides evidence-tiered benefits for key published and draft profiles", () => {
    const catalog = buildPublicLexiconV2Catalog();
    const reta = catalog.bySlug.get("retatrutide");
    expect(reta?.possibleBenefitsDe).toMatch(/Gewichts/i);
    expect(reta?.possibleBenefitsDe).not.toMatch(/Keine Vorteile/i);

    const ghk = catalog.bySlug.get("ghk-cu");
    expect(ghk?.possibleBenefitsDe).toMatch(/Haut|Kollagen|Wundheilung|Gewebeheilung/i);

    const glow = catalog.bySlug.get("glow-blend");
    expect(glow?.possibleBenefitsDe).toMatch(/Synergie|Kombination|Signalwege/i);

    const klow = catalog.bySlug.get("klow-blend");
    expect(klow?.possibleBenefitsDe).toMatch(/GHK-Cu|TB-500|BPC-157/i);
    expect(klow?.possibleBenefitsDe).toMatch(/nicht entsprechend klinisch untersucht|nicht automatisch auf die Mischung/i);

    const fina = catalog.bySlug.get("finasteride");
    expect(fina?.possibleBenefitsDe).toMatch(/5α-Reduktase|DHT|Prostata|Haarausfall/i);
  });

  it("covers legacy public profiles in the benefits catalog", () => {
    const catalog = buildPublicLexiconV2Catalog();
    const missing: string[] = [];
    for (const entry of catalog.entries) {
      if (entry.pdfEvidenceGrade) continue;
      const profile = getBenefitsProfile(entry.slug, entry.blendComponentSlugs);
      if (!profile) missing.push(entry.slug);
    }
    expect(missing).toEqual([]);
  });

  it("never invents PMIDs in curated packs", () => {
    for (const slug of ["ss-31", "adipotide", "5-amino-1mq", "finasteride"]) {
      const pack = getCuratedContentPack(slug);
      expect(pack).toBeDefined();
      for (const source of pack!.sources) {
        if (source.pmid) {
          expect(source.url).toContain(source.pmid);
        }
        if (source.clinicalTrialId) {
          expect(source.url).toContain(source.clinicalTrialId);
        }
      }
    }
  });

  it("reports content coverage across PDF-backed public catalog", () => {
    const catalog = buildPublicLexiconV2Catalog();
    expect(catalog.entries.length).toBeGreaterThanOrEqual(190);
    expect(catalog.entries.every((entry) => entry.shortDescriptionDe.length > 20)).toBe(true);
    expect(catalog.entries.filter((entry) => entry.pdfEvidenceGrade).length).toBeGreaterThanOrEqual(180);
  });

  it("reports benefits coverage for legacy profiles", () => {
    const benefitsReport = buildBenefitsReport();
    expect(benefitsReport.withSupportedPositiveEffects.length).toBeGreaterThanOrEqual(150);
  });

  it("keeps blend components on identified blend drafts", () => {
    const blend = getLexiconV2DraftProfile("mast-blend");
    expect(blend).toBeDefined();
    expect(blend?.blendComponentSlugs).toEqual(["drostanolone-propionate", "drostanolone-enanthate"]);
    expect(blend?.possibleBenefitsDe.text).toMatch(/Drostanolon/i);
  });
});

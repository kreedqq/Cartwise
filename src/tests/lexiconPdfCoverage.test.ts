import { describe, expect, it } from "vitest";

import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import { listPdfResearchProfiles } from "@/lib/peptide/lexiconV2/pdfResearch";
import { slugForPdfProfileName } from "@/lib/peptide/lexiconV2/pdfResearch/slugMap";

const PDF_PROFILE_COUNT = 201;

describe("lexicon PDF research coverage", () => {
  const pdfProfiles = listPdfResearchProfiles();
  const catalog = buildPublicLexiconV2Catalog();

  it("parses all 201 PDF product profiles", () => {
    expect(pdfProfiles).toHaveLength(PDF_PROFILE_COUNT);
  });

  it("maps every PDF profile to a lexicon entry with evidence and approval status", () => {
    const missing: string[] = [];
    const withoutPdfEvidence: string[] = [];
    const withoutLexiconEvidence: string[] = [];

    for (const profile of pdfProfiles) {
      if (!profile.evidenceGrade) withoutPdfEvidence.push(profile.name);

      const slug = slugForPdfProfileName(profile.name);
      const entry = catalog.bySlug.get(slug);
      if (!entry) {
        missing.push(profile.name);
        continue;
      }
      if (!entry.pdfEvidenceGrade) withoutLexiconEvidence.push(profile.name);
      expect(entry.shortDescriptionDe.length).toBeGreaterThan(0);
      if (profile.approvalStatus) {
        expect(entry.approvalStatusDe?.length, profile.name).toBeGreaterThan(0);
      }
    }

    expect(missing, `Missing lexicon entries: ${missing.join(", ")}`).toEqual([]);
    expect(withoutPdfEvidence, `PDF missing evidence: ${withoutPdfEvidence.join(", ")}`).toEqual([]);
    expect(withoutLexiconEvidence, `Lexicon missing evidence: ${withoutLexiconEvidence.join(", ")}`).toEqual([]);
  });

  it("assigns product-specific evidence for combined beta-agonist PDF lines", () => {
    const clen = pdfProfiles.find((p) => p.name === "CLENBUTEROL");
    const sal = pdfProfiles.find((p) => p.name === "SALBUTAMOL");
    expect(clen?.evidenceGrade).toBe("D");
    expect(sal?.evidenceGrade).toBe("A");
    expect(catalog.bySlug.get("clenbuterol")?.pdfEvidenceGrade).toBe("D");
    expect(catalog.bySlug.get("salbutamol")?.pdfEvidenceGrade).toBe("A");
  });

  it("includes expected high-priority profiles from the PDF", () => {
    for (const slug of [
      "retatrutide",
      "tirzepatide",
      "semaglutide",
      "bpc-157",
      "ghk-cu",
      "mots-c",
      "cagrilintide",
      "cjc-1295",
      "ipamorelin",
      "ahk-cu",
      "tb-500-tb4-mix",
    ]) {
      const entry = catalog.bySlug.get(slug);
      expect(entry, slug).toBeDefined();
      expect(entry?.pdfEvidenceGrade).toBeTruthy();
    }
  });

  it("reports PDF category distribution", () => {
    const peptides = pdfProfiles.filter((p) => p.category === "PEPTIDES").length;
    const oils = pdfProfiles.filter((p) => p.category === "OILS / INJECTABLES").length;
    const orals = pdfProfiles.filter((p) => p.category === "ORALS").length;
    expect(peptides).toBe(91);
    expect(oils).toBe(48);
    expect(orals).toBe(62);
  });

  it("uses mostly unique slugs among PDF profiles", () => {
    const slugs = pdfProfiles.map((p) => slugForPdfProfileName(p.name));
    expect(new Set(slugs).size).toBeGreaterThanOrEqual(190);
    expect(slugs.length).toBe(PDF_PROFILE_COUNT);
  });
});

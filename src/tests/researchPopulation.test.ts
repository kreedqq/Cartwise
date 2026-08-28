import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getIdentitySubstance, getSubstanceBySlug } from "@/lib/peptide/catalog";
import {
  allPublishedStatementsCited,
  getPublishedProfile,
  listPublishedProfiles,
} from "@/lib/peptide/profiles";

describe("published research batch", () => {
  it("keeps identity defaults until a sourced profile is applied", () => {
    expect(getIdentitySubstance("semaglutide")?.evidenceLevel).toBe("F");
    expect(getSubstanceBySlug("semaglutide")?.evidenceLevel).toBe("A");
    expect(getSubstanceBySlug("semaglutide")?.regulatoryStatus).toBe("approved-specific");
  });

  it("does not treat missing FDA rows as approval for retatrutide", () => {
    const profile = getPublishedProfile("retatrutide");
    expect(profile?.regulatoryStatus).toBe("clinical-development");
    expect(profile?.evidenceLevel).toBe("B");
    expect(profile?.sources.some((source) => source.clinicalTrialId === "NCT05929066")).toBe(true);
    expect(profile?.sources.some((source) => source.pmid === "37366315")).toBe(true);
    expect(profile?.sources.some((source) => /No matches found|no product match/i.test(source.title))).toBe(true);
  });

  it("keeps TB-500 separate from Thymosin Beta-4 and at evidence F", () => {
    expect(getSubstanceBySlug("tb-500")?.slug).not.toBe(getSubstanceBySlug("thymosin-beta-4")?.slug);
    expect(getPublishedProfile("tb-500")?.evidenceLevel).toBe("F");
    expect(getPublishedProfile("tb-500")?.identity.casNumber).toBe("885340-08-9");
    expect(getPublishedProfile("thymosin-beta-4")?.evidenceLevel).toBe("C");
    expect(getPublishedProfile("thymosin-beta-4")?.regulatoryStatus).toBe("clinical-development");
    expect(getPublishedProfile("tb-500")?.studies.some((study) => study.clinicalTrialId === "NCT07487363")).toBe(false);
    expect(getPublishedProfile("thymosin-beta-4")?.studies.some((study) => study.clinicalTrialId === "NCT07487363")).toBe(
      false,
    );
    expect(getPublishedProfile("tb-500")?.sources.some((source) => source.clinicalTrialId === "NCT07487363")).toBe(
      false,
    );
  });

  it("does not publish Hudson Biotech or mismatched intervention studies", () => {
    for (const profile of listPublishedProfiles()) {
      expect(profile.studies.some((study) => study.sponsor === "Hudson Biotech")).toBe(false);
      expect(profile.studies.some((study) => /mock study|fictional study/i.test(study.title))).toBe(false);
    }
    expect(getPublishedProfile("ipamorelin")?.studies.some((study) => study.clinicalTrialId === "NCT07717866")).toBe(
      false,
    );
    expect(getPublishedProfile("tesamorelin")?.studies.some((study) => study.clinicalTrialId === "NCT02553603")).toBe(
      false,
    );
    expect(getPublishedProfile("mots-c")?.studies.some((study) => study.clinicalTrialId === "NCT07505745")).toBe(false);
    expect(getPublishedProfile("mots-c")?.studies.some((study) => study.clinicalTrialId === "NCT04027712")).toBe(false);
    expect(getPublishedProfile("melanotan-ii")?.studies.some((study) => study.clinicalTrialId === "NCT07437560")).toBe(
      false,
    );
    expect(getPublishedProfile("melanotan-ii")?.studies.some((study) => study.sponsor === "Hudson Biotech")).toBe(false);
  });

  it("keeps orforglipron US-approved without claiming global approval", () => {
    const profile = getPublishedProfile("orforglipron");
    expect(profile?.regulatoryStatus).toBe("approved-specific");
    expect(profile?.regulatoryRegions).toEqual(["US"]);
    expect(profile?.evidenceLevel).toBe("A");
  });

  it("does not treat mazdutide secondary NMPA reports as FDA/global approval", () => {
    const profile = getPublishedProfile("mazdutide");
    expect(profile?.regulatoryStatus).toBe("clinical-development");
    expect(profile?.reviewStatus).toBe("review-required");
    expect(profile?.sources.some((source) => source.pmid === "41028652")).toBe(true);
  });

  it("cites every published scientific statement and excludes mock trials", () => {
    expect(allPublishedStatementsCited()).toBe(true);
    for (const profile of listPublishedProfiles()) {
      expect(profile.studies.some((study) => /mock study/i.test(study.title))).toBe(false);
      expect(profile.community.available).toBe(false);
    }
  });

  it("records official API cache files for the first batch", () => {
    const retatrutide = JSON.parse(
      readFileSync(resolve(process.cwd(), "src/research/cache/fetched/retatrutide.json"), "utf8"),
    ) as { connectors: { fda: { found: boolean }; clinicaltrials: { totalCount: number } } };
    expect(retatrutide.connectors.fda.found).toBe(false);
    expect(retatrutide.connectors.clinicaltrials.totalCount).toBeGreaterThan(0);
  });

  it("treats reviewStatus as a flag, not a second inventory row", () => {
    expect(getPublishedProfile("gonadorelin")?.reviewStatus).toBe("review-required");
    expect(getPublishedProfile("thymosin-alpha-1")?.reviewStatus).toBe("review-required");
    expect(getPublishedProfile("igf-1-lr3")?.reviewStatus).toBe("review-recommended");
    expect(getPublishedProfile("kpv")?.reviewStatus).toBe("fresh");
    expect(getPublishedProfile("gonadorelin")?.evidenceLevel).toBe("E");
    expect(getPublishedProfile("thymosin-alpha-1")?.evidenceLevel).toBe("C");
  });

  it("applies Batch 02 sourced overlays without merging related molecules", () => {
    expect(listPublishedProfiles()).toHaveLength(27);
    expect(getPublishedProfile("somatropin")?.evidenceLevel).toBe("A");
    expect(getPublishedProfile("somatropin")?.regulatoryStatus).toBe("approved-specific");
    expect(getPublishedProfile("somatropin")?.regulatoryRegions).toEqual(["US", "EU"]);
    expect(getPublishedProfile("hcg")?.evidenceLevel).toBe("A");
    expect(getPublishedProfile("hcg")?.regulatoryRegions).toEqual(["US"]);
    expect(getPublishedProfile("hcg")?.sources.some((source) => /CID 1108/.test(source.title))).toBe(false);
    expect(getPublishedProfile("igf-1-lr3")?.evidenceLevel).toBe("F");
    expect(getPublishedProfile("igf-1-lr3")?.identity.identityNote).toMatch(/Mecasermin/i);
    expect(getPublishedProfile("igf-1-lr3")?.sources.some((source) => source.pmid === "22227200")).toBe(false);
    expect(getPublishedProfile("melanotan-ii")?.identity.identityNote).toMatch(/Afamelanotid|Scenesse/i);
    expect(getPublishedProfile("glow-blend")?.identity.moleculeType).toBe("blend");
    expect(getPublishedProfile("glow-blend")?.studies).toEqual([]);
    expect(getPublishedProfile("selank")?.studies).toEqual([]);
    expect(getPublishedProfile("gonadorelin")?.regulatoryStatus).toBe("insufficient");
    expect(getPublishedProfile("kpv")?.evidenceLevel).toBe("D");
  });
});

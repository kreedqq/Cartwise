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
    expect(getPublishedProfile("thymosin-beta-4")).toBeUndefined();
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
});

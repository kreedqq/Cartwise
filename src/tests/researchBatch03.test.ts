import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { getPublishedProfile, listPublishedProfiles } from "@/lib/peptide/profiles";
import {
  classifySourceQuality,
  hudsonExcludedNcts,
  identityMustStaySeparate,
  isHudsonExcludedNct,
  isHudsonSponsor,
  keepArticle,
  keepStudy,
} from "@/lib/peptide/research/sourceValidation";

const BATCH03 = resolve(process.cwd(), "src/research/cache/fetched/batch03");

function readJson(name: string) {
  return JSON.parse(readFileSync(resolve(BATCH03, name), "utf8")) as Record<string, unknown>;
}

describe("research batch 03 quality/recency/coverage", () => {
  const analysis = readJson("analysis.json") as {
    productionWrite: boolean;
    publishedJsonMutated: boolean;
    community: string;
    hudsonExclusions: string[];
    unresolvedRegulatory: string[];
    unresolvedMapping: string[];
    evidencePolicy: {
      overlayAFUnchanged: boolean;
      reviewRequiredNotAutoApproved: boolean;
      communityCannotRaiseEvidence: boolean;
    };
    identity: Record<string, boolean>;
    regulatoryHighlights: {
      orforglipronFdaFound: boolean;
      retatrutideFdaFound: boolean;
      retatrutideNotApproved: boolean;
      tesamorelinEmaEgrifta: string;
      orforglipronEma: Array<{ status: number }>;
      retatrutideEma: { status: number };
    };
    totals: {
      substancesReviewed: number;
      claimsAdded: number;
      claimsUpdated: number;
      evidenceChanges: number;
      regulatoryChanges: number;
      identityCorrections: number;
      sourcesAcceptedNewReviewRequired: number;
      studiesValidatedNew: number;
    };
    studiesAccepted: Array<{ slug: string; nctId: string; title: string }>;
    studiesRejected: Array<{ slug: string; nctId: string; reason: string }>;
    substances: Array<{ slug: string; lastReviewedBatch03: string }>;
  };

  it("records a local research run without writing production or published.json", () => {
    expect(existsSync(resolve(BATCH03, "run.json"))).toBe(true);
    const run = readJson("run.json") as {
      batch_label: string;
      status: string;
      productionWrite: boolean;
      started_at: string;
      completed_at: string;
      connector: string;
    };
    expect(run.batch_label).toBe("batch-03");
    expect(run.status).toBe("completed");
    expect(run.productionWrite).toBe(false);
    expect(run.started_at).toMatch(/^2026-08-29T00:07:55/);
    expect(Date.parse(run.completed_at)).toBeGreaterThan(Date.parse(run.started_at));
    expect(run.connector).toContain("clinicaltrials.gov");
    expect(analysis.productionWrite).toBe(false);
    expect(analysis.publishedJsonMutated).toBe(false);
    expect(listPublishedProfiles()).toHaveLength(27);
  });

  it("validates studies by title, sponsor, identifier, and identity filters", () => {
    expect(
      keepStudy("retatrutide", {
        nctId: "NCT05929066",
        title: "A Study of Retatrutide (LY3437943) in Participants Who Have Obesity or Overweight",
        sponsor: "Eli Lilly and Company",
      }),
    ).toBe(true);
    expect(
      keepStudy("retatrutide", {
        nctId: "NCT07226947",
        title: "Body Composition and Exercise to Prevent Muscle Loss With GLP1 Agonist Treatment",
        sponsor: "University example",
      }),
    ).toBe(false);
    expect(
      keepStudy("tb-500", {
        nctId: "NCT07487363",
        title: "TB-500 (Thymosin Beta 4 17-23 Fragment) for Cardiovascular Biomarkers in Stable ASCVD",
        sponsor: "Hudson Biotech",
      }),
    ).toBe(false);
    expect(
      keepStudy("melanotan-ii", {
        nctId: "NCT07437560",
        title: "Melanotan II example",
        sponsor: "Hudson Biotech",
      }),
    ).toBe(false);
    expect(
      keepArticle("igf-1-lr3", { pmid: "22227200", title: "Sheep rumen IGF-1" }),
    ).toBe(false);
    expect(analysis.studiesAccepted.every((row) => /^NCT\d{8}$/.test(row.nctId))).toBe(true);
    expect(analysis.studiesAccepted.some((row) => row.nctId === "NCT07226947")).toBe(false);
  });

  it("keeps Hudson NCTs unpublished and rejects Hudson sponsor hits", () => {
    expect(hudsonExcludedNcts()).toEqual([...EXCLUDED_STUDY_NCTS]);
    expect(isHudsonExcludedNct("NCT07487363")).toBe(true);
    expect(isHudsonExcludedNct("NCT07437560")).toBe(true);
    expect(isHudsonSponsor("Hudson Biotech")).toBe(true);
    const hudson = analysis.studiesRejected.filter(
      (row) => row.reason === "hudson-exclusion" || row.reason === "hudson-sponsor",
    );
    expect(hudson.some((row) => row.nctId === "NCT07487363")).toBe(true);
    expect(hudson.some((row) => row.nctId === "NCT07437560")).toBe(true);
    expect(getPublishedProfile("tb-500")?.studies.some((study) => study.clinicalTrialId === "NCT07487363")).toBe(false);
    expect(getPublishedProfile("melanotan-ii")?.studies.some((study) => study.clinicalTrialId === "NCT07437560")).toBe(
      false,
    );
  });

  it("does not auto-publish new claims, evidence, or regulatory status changes", () => {
    expect(analysis.totals.claimsAdded).toBe(0);
    expect(analysis.totals.claimsUpdated).toBe(0);
    expect(analysis.totals.evidenceChanges).toBe(0);
    expect(analysis.totals.regulatoryChanges).toBe(0);
    expect(analysis.totals.identityCorrections).toBe(0);
    expect(analysis.evidencePolicy.reviewRequiredNotAutoApproved).toBe(true);
    expect(analysis.evidencePolicy.overlayAFUnchanged).toBe(true);
    expect(analysis.totals.sourcesAcceptedNewReviewRequired).toBeGreaterThan(0);
    expect(analysis.totals.studiesValidatedNew).toBeGreaterThan(0);
    const claims = publishedClaimsSeed();
    expect(claims.evidenceAssessments.filter((row) => row.reviewStatus === "review-required")).toHaveLength(267);
    expect(claims.evidenceAssessments.filter((row) => row.evidenceLevel)).toHaveLength(27);
  });

  it("keeps claim traceability and community isolation", () => {
    expect(analysis.community).toBe("unavailable");
    expect(analysis.evidencePolicy.communityCannotRaiseEvidence).toBe(true);
    for (const profile of listPublishedProfiles()) {
      expect(profile.community.available).toBe(false);
      for (const block of Object.values(profile.summary)) {
        expect(block.sourceIds.length).toBeGreaterThan(0);
      }
    }
    expect(classifySourceQuality({ sourceType: "regulatory", publisher: "EMA" })).toBe("regulatory");
    expect(classifySourceQuality({ sourceType: "clinical_trial" })).toBe("clinical_trial");
    expect(classifySourceQuality({ sourceType: "scientific", publisher: "NCBI PubChem" })).toBe("database");
  });

  it("preserves identity separations and unresolved mapping/regulatory rows", () => {
    expect(identityMustStaySeparate("tb-500", "thymosin-beta-4")).toBe(true);
    expect(identityMustStaySeparate("melanotan-ii", "afamelanotide")).toBe(true);
    expect(identityMustStaySeparate("igf-1-lr3", "mecasermin")).toBe(true);
    expect(analysis.identity["tb-500_ne_thymosin-beta-4"]).toBe(true);
    expect(analysis.identity["glow-blend_is_blend"]).toBe(true);
    expect(getPublishedProfile("glow-blend")?.identity.moleculeType).toBe("blend");
    expect(getPublishedProfile("hcg")?.regulatoryRegions).toEqual(["US"]);
    expect(analysis.unresolvedRegulatory).toEqual(["hcg:ema-ovitrelle", "semaglutide:fda-semaglutide-27f15fac"]);
    expect(analysis.unresolvedMapping).toEqual(["BT*", "MT1", "KL80", "multi-INN blends", "fragments", "amides"]);
    const seed = publishedRegulatorySeed();
    const unresolved = seed.reconciliation
      .filter((row) => row.status === "UNRESOLVED" && !row.jsonRef.includes("overlay"))
      .map((row) => row.jsonRef)
      .sort();
    expect(unresolved).toEqual(["hcg:ema-ovitrelle", "semaglutide:fda-semaglutide-27f15fac"]);
  });

  it("documents recency checks for orforglipron, retatrutide, and tesamorelin without guessing approval", () => {
    expect(analysis.totals.substancesReviewed).toBe(27);
    expect(analysis.substances).toHaveLength(27);
    expect(analysis.regulatoryHighlights.orforglipronFdaFound).toBe(true);
    expect(analysis.regulatoryHighlights.orforglipronEma.every((row) => row.status === 404)).toBe(true);
    expect(analysis.regulatoryHighlights.retatrutideFdaFound).toBe(false);
    expect(analysis.regulatoryHighlights.retatrutideEma.status).toBe(404);
    expect(analysis.regulatoryHighlights.retatrutideNotApproved).toBe(true);
    expect(analysis.regulatoryHighlights.tesamorelinEmaEgrifta).toBe("withdrawn-2012-not-eu-approval");
    expect(getPublishedProfile("orforglipron")?.regulatoryRegions).toEqual(["US"]);
    expect(getPublishedProfile("retatrutide")?.regulatoryStatus).toBe("clinical-development");
    expect(getPublishedProfile("tesamorelin")?.regulatoryRegions).toEqual(["US"]);
    const regulatory = readJson("regulatory-check.json") as {
      bfarm: { status: string };
      mhra: { status: string };
      nmpa: { status: string };
      ema: Array<{ slug: string; interpretation?: string }>;
    };
    expect(regulatory.bfarm.status).toBe("unavailable");
    expect(regulatory.mhra.status).toBe("unavailable");
    expect(regulatory.nmpa.status).toBe("unavailable");
    expect(regulatory.ema.find((row) => row.slug === "tesamorelin-egrifta")?.interpretation).toMatch(/withdrawn/i);
  });
});

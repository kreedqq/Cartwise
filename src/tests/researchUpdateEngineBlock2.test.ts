/**
 * Research Update Engine tests.
 * Fixtures below are TEST FIXTURES only and must never be written to production.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isPublicSource, isPublicStudy } from "@/lib/peptide/lexicon/publicVisibility";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";
import {
  AVAILABLE_SCIENTIFIC_CONNECTORS,
  candidateIsPublic,
  cannotMergeSlugs,
  communityCannotRaiseEvidence,
  detectSourceChange,
  engineAdminCapabilities,
  inspectEma404,
  inspectFdaEmptySearch,
  matchSubstance,
  normalizeClinicalTrial,
  normalizeEmaResult,
  normalizeFdaResult,
  normalizePubmedArticle,
  persistPlanFromRun,
  redditUpdateConnector,
  resetRateLimitState,
  resolveScope,
  runResearchUpdate,
  scientificAdapter,
  shouldRetry,
  startEngineRun,
  UPDATE_ENGINE_CRON_ENABLED,
  updateAllMeansSubstancesNotShop,
  withRateLimit,
} from "@/lib/peptide/research/updateEngine";
import { identityCatalog } from "@/lib/peptide/research/updateEngine/matchIdentity";
import { nmpaConnector, redditConnector, scientificConnectors } from "@/research/connectors";

const MIGRATION_0031 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0031_research_operations.sql"),
  "utf8",
);

const catalog = identityCatalog();

/** TEST FIXTURE — PubMed ESummary compact shape. */
const RETA_PUBMED = {
  pmid: "39325560",
  title: "Retatrutide, a GIP, GLP-1 and glucagon receptor agonist",
  source: "Lancet",
  pubdate: "2024",
  authors: ["Test Author"],
  doi: "10.1016/S0140-6736(24)00000-0",
  url: "https://pubmed.ncbi.nlm.nih.gov/39325560/",
};

/** TEST FIXTURE — CT.gov v2 compact shape. */
const RETA_TRIAL = {
  nctId: "NCT06065540",
  title: "Retatrutide in adults with obesity",
  sponsor: "Eli Lilly",
  intervention: "retatrutide",
  condition: "obesity",
  phase: "PHASE3",
  status: "RECRUITING",
  lastUpdate: "2026-01-01",
  url: "https://clinicaltrials.gov/study/NCT06065540",
};

function pubmedConnector(rows: unknown[]) {
  return scientificAdapter({
    id: "pubmed",
    label: "PubMed",
    search: async () => rows,
  });
}

function ctgovConnector(rows: unknown[]) {
  return scientificAdapter({
    id: "clinicaltrials",
    label: "ClinicalTrials.gov",
    search: async () => rows,
  });
}

describe("research update engine contract", () => {
  it("keeps scientific connectors independent and community separate", () => {
    expect(AVAILABLE_SCIENTIFIC_CONNECTORS).toEqual(["pubmed", "clinicaltrials", "fda", "ema"]);
    expect(communityCannotRaiseEvidence("community")).toBe(true);
    expect(communityCannotRaiseEvidence("scientific")).toBe(false);
    expect(scientificConnectors().some((row) => row.id === "nmpa")).toBe(true);
    expect(nmpaConnector.id).toBe("nmpa");
  });
});

describe("normalization", () => {
  it("normalizes PubMed PMID, DOI, title, journal, date, url", () => {
    const record = normalizePubmedArticle(RETA_PUBMED, { slug: "retatrutide", now: "2026-08-29T00:00:00.000Z" });
    expect(record?.pmid).toBe("39325560");
    expect(record?.doi).toBe("10.1016/s0140-6736(24)00000-0");
    expect(record?.publisher).toBe("Lancet");
    expect(record?.url).toContain("39325560");
    expect(record?.connector).toBe("pubmed");
  });

  it("normalizes CT.gov NCT, sponsor, intervention, condition, phase, status", () => {
    const record = normalizeClinicalTrial(RETA_TRIAL, { slug: "retatrutide", now: "2026-08-29T00:00:00.000Z" });
    expect(record?.nctId).toBe("NCT06065540");
    expect(record?.study?.sponsor).toBe("Eli Lilly");
    expect(record?.study?.intervention).toBe("retatrutide");
    expect(record?.study?.condition).toBe("obesity");
  });

  it("does not treat empty FDA search as not_approved", () => {
    const empty = inspectFdaEmptySearch({ ok: true, status: 404, found: false, products: [] }, "retatrutide");
    expect(empty).toMatchObject({ kind: "empty-search", notApproved: false });
    const found = normalizeFdaResult(
      {
        ok: true,
        found: true,
        products: [{ sponsor: "Lilly", application: "NDA999", products: [{ brand: "Example", marketing: "Prescription" }] }],
      },
      { slug: "retatrutide", now: "2026-08-29T00:00:00.000Z" },
    );
    expect(found.kind).toBe("record");
    if (found.kind === "record") expect(found.record.regulatory?.region).toBe("US");
  });

  it("does not store EMA 404 as regulatory evidence", () => {
    const missing = inspectEma404({ ok: false, status: 404 }, "orforglipron");
    expect(missing).toEqual({ kind: "http-404", storedAsEvidence: false });
    const record = normalizeEmaResult(
      { ok: true, status: 200, url: "https://www.ema.europa.eu/en/medicines/human/EPAR/mounjaro", productName: "Mounjaro" },
      { slug: "tirzepatide", now: "2026-08-29T00:00:00.000Z" },
    );
    expect(record.kind).toBe("record");
    if (record.kind === "record") expect(record.record.regulatory?.region).toBe("EU");
  });
});

describe("duplicate and change detection", () => {
  it("classifies NEW, UNCHANGED, UPDATED, DUPLICATE", () => {
    const record = normalizePubmedArticle(RETA_PUBMED, { slug: "retatrutide", now: "2026-08-29T00:00:00.000Z" })!;
    const seen = new Set<string>();
    expect(detectSourceChange(record, [], seen).disposition).toBe("NEW");
    seen.add("pmid:39325560");
    expect(detectSourceChange(record, [], seen).disposition).toBe("DUPLICATE");
    const existing = [{ pmid: "39325560", doi: record.doi, nctId: null, title: record.title, publicationDate: record.publicationDate, url: record.url }];
    expect(detectSourceChange(record, existing, new Set()).disposition).toBe("UNCHANGED");
    expect(
      detectSourceChange({ ...record, title: "Retatrutide revised title" }, existing, new Set()).disposition,
    ).toBe("UPDATED");
  });
});

describe("identity matching", () => {
  it("protects TB-500, Melanotan II, IGF-1 LR3, glow-blend, hCG", () => {
    expect(cannotMergeSlugs("tb-500", "thymosin-beta-4")).toBe(true);
    expect(cannotMergeSlugs("melanotan-ii", "afamelanotide")).toBe(true);
    expect(cannotMergeSlugs("igf-1-lr3", "mecasermin")).toBe(true);
    expect(cannotMergeSlugs("glow-blend", "bpc-157")).toBe(true);
    expect(matchSubstance({ requestedSlug: "melanotan-ii", title: "Afamelanotide (Scenesse)", kind: "article", catalog }).confidence).toBe(
      "uncertain",
    );
    expect(matchSubstance({ requestedSlug: "hcg", title: "Ovitrelle choriogonadotropin alfa", kind: "article", catalog }).reason).toBe(
      "urinary-hcg-not-ovitrelle",
    );
    expect(matchSubstance({ requestedSlug: "retatrutide", title: RETA_PUBMED.title, kind: "article", catalog }).confidence).toBe(
      "exact",
    );
  });
});

describe("hudson exclusion", () => {
  it("rejects Hudson NCTs as sources and studies", async () => {
    expect(EXCLUDED_STUDY_NCTS).toEqual(["NCT07487363", "NCT07437560"]);
    const result = await runResearchUpdate({
      scope: resolveScope({ substanceSlug: "tb-500", connector: "clinicaltrials" }),
      catalog,
      existingSources: [],
      existingStudies: [],
      connectors: [
        ctgovConnector([
          {
            nctId: "NCT07487363",
            title: "Hudson Biotech TB-500",
            sponsor: "Hudson Biotech",
            intervention: "TB-500",
            condition: "none",
            status: "RECRUITING",
          },
        ]),
      ],
    });
    expect(result.statistics.sourcesRejected).toBeGreaterThan(0);
    expect(result.candidates).toEqual([]);
    expect(result.claimsAdded).toBe(0);
  });
});

describe("research runs", () => {
  it("scopes all / single substance / single connector", () => {
    const all = resolveScope({});
    expect(all.trigger).toBe("full");
    expect(all.substanceSlugs).toHaveLength(27);
    expect(updateAllMeansSubstancesNotShop(all)).toBe(true);
    expect(resolveScope({ substanceSlug: "retatrutide" }).connectors).toEqual(AVAILABLE_SCIENTIFIC_CONNECTORS);
    expect(resolveScope({ connector: "pubmed" }).substanceSlugs).toHaveLength(27);
    expect(resolveScope({ substanceSlug: "retatrutide", connector: "clinicaltrials" }).connectors).toEqual([
      "clinicaltrials",
    ]);
  });

  it("creates review-required candidates and never auto-approves", async () => {
    const result = await runResearchUpdate({
      scope: resolveScope({ substanceSlug: "retatrutide", connector: "pubmed" }),
      catalog,
      existingSources: [],
      existingStudies: [],
      connectors: [pubmedConnector([RETA_PUBMED])],
    });
    expect(result.status).toBe("completed");
    expect(result.statistics.sourcesNew).toBe(1);
    expect(result.candidates[0]?.reviewStatus).toBe("review-required");
    expect(result.claimsAdded).toBe(0);
    expect(result.evidenceUpgraded).toBe(0);
    expect(result.productionWrite).toBe(false);
    const plan = persistPlanFromRun(result.candidates);
    expect(plan.autoApprove).toBe(false);
    expect(plan.claimsAdded).toBe(0);
    expect(candidateIsPublic(result.candidates[0]!)).toBe(false);
    expect(isPublicSource({ nct_id: null, review_status: "review-required" })).toBe(false);
    expect(isPublicStudy({ nct_id: "NCT06065540", substanceCount: 1, review_status: "review-required" })).toBe(false);
  });

  it("is idempotent against an existing catalog", async () => {
    const existing = [
      {
        pmid: "39325560",
        doi: "10.1016/s0140-6736(24)00000-0",
        nctId: null,
        title: RETA_PUBMED.title,
        publicationDate: "2024",
        url: RETA_PUBMED.url,
      },
    ];
    const first = await runResearchUpdate({
      scope: resolveScope({ substanceSlug: "retatrutide", connector: "pubmed" }),
      catalog,
      existingSources: existing,
      existingStudies: [],
      connectors: [pubmedConnector([RETA_PUBMED])],
    });
    const second = await runResearchUpdate({
      scope: resolveScope({ substanceSlug: "retatrutide", connector: "pubmed" }),
      catalog,
      existingSources: existing,
      existingStudies: [],
      connectors: [pubmedConnector([RETA_PUBMED])],
    });
    expect(first.statistics.sourcesUnchanged).toBe(1);
    expect(first.candidates.filter((row) => row.disposition === "NEW")).toHaveLength(0);
    expect(second.statistics.sourcesNew).toBe(0);
    expect(second.statistics.sourcesUnchanged).toBe(1);
  });

  it("marks partial when one connector fails and others pass", async () => {
    const result = await runResearchUpdate({
      scope: resolveScope({
        substanceSlug: "retatrutide",
        connectors: ["pubmed", "clinicaltrials", "fda"],
      }),
      catalog,
      existingSources: [],
      existingStudies: [],
      connectors: [
        pubmedConnector([RETA_PUBMED]),
        ctgovConnector([RETA_TRIAL]),
        scientificAdapter({
          id: "fda",
          label: "FDA",
          search: async () => {
            throw Object.assign(new Error("fda down"), { status: 503 });
          },
        }),
      ],
    });
    expect(result.status).toBe("partial");
    expect(result.statistics.errors).toBe(1);
    expect(result.statistics.sourcesNew).toBeGreaterThan(0);
  });

  it("retries rate-limited calls with backoff", async () => {
    resetRateLimitState();
    let calls = 0;
    const value = await withRateLimit(
      "pubmed-test",
      async () => {
        calls += 1;
        if (calls === 1) {
          const error = new Error("too many requests");
          (error as Error & { status: number }).status = 429;
          throw error;
        }
        return "ok";
      },
      { minIntervalMs: 0, maxRetries: 2, backoffMs: 1, sleep: async () => undefined },
    );
    expect(value).toBe("ok");
    expect(calls).toBe(2);
    expect(shouldRetry({ status: 429 })).toBe(true);
    expect(shouldRetry({ status: 400 })).toBe(false);
  });
});

describe("community boundary and schedule", () => {
  it("does not implement community fetch and keeps cron off", async () => {
    expect(UPDATE_ENGINE_CRON_ENABLED).toBe(false);
    expect(engineAdminCapabilities()).toMatchObject({ cronEnabled: false, autoApprove: false, productionWrite: false });
    const reddit = await redditUpdateConnector.search({
      substance: catalog[0]!,
      now: "2026-08-29T00:00:00.000Z",
    });
    expect(reddit.ok).toBe(false);
    expect(reddit.records).toEqual([]);
    const browser = await redditConnector.search({ name: "retatrutide" });
    expect(browser.ok).toBe(false);
  });
});

describe("migration 0031", () => {
  it("is schema-only and does not mutate shop", () => {
    expect(MIGRATION_0031).toContain("Schema-only");
    expect(MIGRATION_0031).toContain("partial");
    expect(MIGRATION_0031).toContain("trigger_kind");
    expect(MIGRATION_0031).not.toMatch(/\bDROP TABLE\b/i);
    expect(MIGRATION_0031).not.toMatch(/\bpublic\.(products|carts|orders)\b/);
  });
});

describe("admin API", () => {
  it("can start update-substance without writing production", async () => {
    const started = await startEngineRun({
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors: [pubmedConnector([RETA_PUBMED])],
    });
    expect(started.scope.substanceSlugs).toEqual(["retatrutide"]);
    expect(started.persistPlan.productionWrite).toBe(false);
    expect(started.persistPlan.regulatoryAutoApproved).toBe(0);
  });
});

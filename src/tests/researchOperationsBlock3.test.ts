/**
 * Research Operations Block 3 tests.
 * Fixtures below are TEST FIXTURES only and must never be written to production.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isIntakePlaceholderId } from "@/lib/peptide/research/batch03Intake";
import { isPublicCommunityReport, isPublicSource, isPublicStudy } from "@/lib/peptide/lexicon/publicVisibility";
import {
  applySourceReview,
  applyStudyReview,
  assertCanStartRun,
  emptyOperationsStore,
  hasActiveFullRun,
  inventoryUnchanged,
  isPersistedUuid,
  OPERATIONS_CRON_ENABLED,
  OPERATIONS_MIGRATION_REQUIRED,
  OPERATIONS_PRODUCTION_WRITE,
  pageRuns,
  persistReviewCandidates,
  REDDIT_CONNECTOR_STATUS,
  refuseCommunityImport,
  requestRunCancel,
  retryPersistedRun,
  startPersistedRun,
  communityCannotRaiseClaims,
  communityCannotRaiseRegulatory,
  communityCannotRaiseScientificEvidence,
} from "@/lib/peptide/research/operations";
import { resetOperationsUuidSeq } from "@/lib/peptide/research/operations/ids";
import { scientificAdapter } from "@/lib/peptide/research/updateEngine";
import { EMPTY_STATISTICS } from "@/lib/peptide/research/updateEngine/types";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";

const MIGRATION = readFileSync(resolve(process.cwd(), "supabase/migrations/0031_research_operations.sql"), "utf8");

/** TEST FIXTURE — PubMed compact cache shape. */
const RETA_PUBMED = {
  pmid: "39325560",
  title: "Retatrutide, a GIP, GLP-1 and glucagon receptor agonist",
  source: "Lancet",
  pubdate: "2024",
  doi: "10.1016/S0140-6736(24)00000-0",
  url: "https://pubmed.ncbi.nlm.nih.gov/39325560/",
};

function pubmedConnector(rows: unknown[], onSearch?: (slug: string) => void) {
  return scientificAdapter({
    id: "pubmed",
    label: "PubMed",
    retry: { minIntervalMs: 0, maxRetries: 0, backoffMs: 0 },
    search: async (substance) => {
      onSearch?.(substance.slug);
      return rows;
    },
  });
}

function failingFda() {
  return scientificAdapter({
    id: "fda",
    label: "FDA",
    retry: { minIntervalMs: 0, maxRetries: 0, backoffMs: 0 },
    search: async () => {
      throw Object.assign(new Error("fda down"), { status: 503 });
    },
  });
}

describe("research operations migration", () => {
  it("is schema-only and does not touch shop tables", () => {
    expect(MIGRATION).toContain("Schema-only");
    expect(MIGRATION).toContain("Does not UPDATE/DELETE research science rows");
    expect(MIGRATION).toContain("research_runs_one_active_full");
    expect(MIGRATION).toContain("create table if not exists public.community_reports");
    expect(MIGRATION).toContain("community_report");
    expect(MIGRATION).toContain("review_status = 'approved'");
    expect(MIGRATION).toContain("research_runs_select_admin");
    expect(MIGRATION).not.toMatch(/\bpublic\.(products|carts|orders)\b/);
    expect(MIGRATION).not.toMatch(/\bupdate public\.(sources|studies|claims|evidence_assessments|regulatory_records)\b/i);
    expect(OPERATIONS_MIGRATION_REQUIRED).toBe("0031_research_operations.sql");
    expect(OPERATIONS_PRODUCTION_WRITE).toBe(false);
    expect(OPERATIONS_CRON_ENABLED).toBe(false);
  });
});

describe("run persistence", () => {
  it("persists run history, sources as review-required, and is idempotent", async () => {
    resetOperationsUuidSeq();
    const store = emptyOperationsStore();
    const connectors = [pubmedConnector([RETA_PUBMED])];
    const first = await startPersistedRun({
      store,
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors,
      now: "2026-08-29T10:00:00.000Z",
    });
    expect(first.run.status).toBe("completed");
    expect(store.runs).toHaveLength(1);
    expect(store.sources).toHaveLength(1);
    expect(store.sources[0]?.reviewStatus).toBe("review-required");
    expect(isPersistedUuid(store.sources[0]?.id)).toBe(true);
    expect(isPublicSource({ nct_id: null, review_status: store.sources[0]!.reviewStatus })).toBe(false);
    expect(first.persist.claimsAdded).toBe(0);
    expect(inventoryUnchanged(store)).toBe(true);

    const second = await startPersistedRun({
      store,
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors,
      now: "2026-08-29T10:01:00.000Z",
    });
    expect(second.engine.statistics.sourcesNew).toBe(0);
    expect(second.engine.statistics.sourcesUnchanged).toBe(1);
    expect(store.sources).toHaveLength(1);
    expect(pageRuns(store, 0, 20).total).toBe(2);
  });

  it("supports update-all, single connector, and combined scope", async () => {
    const store = emptyOperationsStore();
    const connectors = [pubmedConnector([RETA_PUBMED])];
    const all = await startPersistedRun({ store, action: "update-all", connectors, now: "2026-08-29T11:00:00.000Z" });
    expect(all.run.trigger).toBe("full");
    expect(all.run.scope.substanceSlugs).toHaveLength(27);
    const one = await startPersistedRun({
      store: emptyOperationsStore(),
      action: "update-connector",
      connector: "pubmed",
      connectors,
      now: "2026-08-29T11:01:00.000Z",
    });
    expect(one.run.scope.connectors).toEqual(["pubmed"]);
    const combined = await startPersistedRun({
      store: emptyOperationsStore(),
      action: "update-combined",
      substanceSlug: "retatrutide",
      connector: "pubmed",
      connectors,
      now: "2026-08-29T11:02:00.000Z",
    });
    expect(combined.run.scope.substanceSlugs).toEqual(["retatrutide"]);
    expect(combined.run.scope.connectors).toEqual(["pubmed"]);
  });
});

describe("cancel retry concurrency", () => {
  it("cancels without persisting half-finished review states", async () => {
    resetOperationsUuidSeq();
    const store = emptyOperationsStore();
    const result = await startPersistedRun({
      store,
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors: [
        pubmedConnector([RETA_PUBMED], () => {
          requestRunCancel(store, store.runs[0]!.id);
        }),
        scientificAdapter({
          id: "clinicaltrials",
          label: "ClinicalTrials.gov",
          retry: { minIntervalMs: 0, maxRetries: 0, backoffMs: 0 },
          search: async () => [],
        }),
      ],
      now: "2026-08-29T12:00:00.000Z",
    });
    expect(result.run.status).toBe("cancelled");
    expect(store.sources).toHaveLength(0);
    expect(store.runs[0]?.reviewCandidates).toBe(0);
  });

  it("retries partial runs without duplicating sources", async () => {
    resetOperationsUuidSeq();
    const store = emptyOperationsStore();
    const first = await startPersistedRun({
      store,
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors: [pubmedConnector([RETA_PUBMED]), failingFda()],
      now: "2026-08-29T12:10:00.000Z",
    });
    expect(first.run.status).toBe("partial");
    expect(store.sources).toHaveLength(1);
    const retry = await retryPersistedRun({
      store,
      runId: first.run.id,
      connectors: [pubmedConnector([RETA_PUBMED]), failingFda()],
      now: "2026-08-29T12:11:00.000Z",
    });
    expect(retry.run.parentRunId).toBe(first.run.id);
    expect(store.sources).toHaveLength(1);
  });

  it("blocks a second full run while one is active", async () => {
    const store = emptyOperationsStore();
    store.runs.push({
      id: "00000000-0000-4000-8000-000000000099",
      startedAt: "2026-08-29T12:20:00.000Z",
      completedAt: null,
      status: "running",
      trigger: "full",
      scope: { trigger: "full", substanceSlugs: ["retatrutide"], connectors: ["pubmed"] },
      statistics: { ...EMPTY_STATISTICS },
      errorSummary: null,
      parentRunId: null,
      cancelRequested: false,
      progress: { connector: "pubmed", substance: "retatrutide" },
      reviewCandidates: 0,
    });
    expect(hasActiveFullRun(store)).toBe(true);
    expect(() => assertCanStartRun(store, "update-all")).toThrow(/Full Run/);
  });
});

describe("change detection review and approval", () => {
  it("stores UPDATED diffs and requires UUID for approve/reject", async () => {
    resetOperationsUuidSeq();
    const store = emptyOperationsStore();
    await startPersistedRun({
      store,
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors: [pubmedConnector([RETA_PUBMED])],
      now: "2026-08-29T13:00:00.000Z",
    });
    const changed = {
      ...RETA_PUBMED,
      title: "Retatrutide revised title",
    };
    const updated = await startPersistedRun({
      store,
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors: [pubmedConnector([changed])],
      now: "2026-08-29T13:01:00.000Z",
    });
    expect(updated.engine.statistics.sourcesUpdated).toBe(1);
    expect(store.sources[0]?.reviewStatus).toBe("review-required");
    expect(store.sources[0]?.previousTitle).toBe(RETA_PUBMED.title);
    expect(store.logs.some((row) => row.resultType === "UPDATED" && row.previousFields && row.currentFields)).toBe(true);

    const approved = applySourceReview({
      store,
      isAdmin: true,
      adminUserId: "00000000-0000-4000-8000-000000000042",
      id: store.sources[0]!.id,
      action: "approve",
      reason: "Verified PubMed record",
    });
    expect(approved.reviewStatus).toBe("approved");
    expect(store.reviewActions).toHaveLength(1);
    expect(store.reviewActions[0]?.action).toBe("approve");
    expect(inventoryUnchanged(store)).toBe(true);

    expect(() =>
      applySourceReview({
        store,
        isAdmin: true,
        adminUserId: null,
        id: "intake:source-1",
        action: "approve",
        reason: "placeholder",
      }),
    ).toThrow(/UUID/);
    expect(isIntakePlaceholderId("intake:source-1")).toBe(true);
    expect(() =>
      applyStudyReview({
        store,
        isAdmin: true,
        adminUserId: null,
        id: "not-a-uuid",
        action: "reject",
        reason: "invalid",
      }),
    ).toThrow(/UUID/);
  });

  it("rejects Hudson NCTs and does not persist them", async () => {
    const store = emptyOperationsStore();
    const result = await startPersistedRun({
      store,
      action: "update-combined",
      substanceSlug: "tb-500",
      connector: "clinicaltrials",
      connectors: [
        scientificAdapter({
          id: "clinicaltrials",
          label: "ClinicalTrials.gov",
          retry: { minIntervalMs: 0, maxRetries: 0, backoffMs: 0 },
          search: async () => [
            {
              nctId: EXCLUDED_STUDY_NCTS[0],
              title: "Hudson Biotech TB-500",
              sponsor: "Hudson Biotech",
              intervention: "TB-500",
              status: "RECRUITING",
            },
          ],
        }),
      ],
      now: "2026-08-29T13:10:00.000Z",
    });
    expect(result.engine.statistics.sourcesRejected).toBeGreaterThan(0);
    expect(store.sources).toHaveLength(0);
    expect(store.studies).toHaveLength(0);
  });
});

describe("public visibility community rls", () => {
  it("hides review-required science and community from public", () => {
    expect(isPublicSource({ nct_id: null, review_status: "review-required" })).toBe(false);
    expect(isPublicStudy({ nct_id: "NCT06065540", substanceCount: 1, review_status: "review-required" })).toBe(false);
    expect(isPublicCommunityReport({ review_status: "review-required" })).toBe(false);
    expect(isPublicCommunityReport({ review_status: "approved" })).toBe(true);
    expect(communityCannotRaiseScientificEvidence()).toBe(true);
    expect(communityCannotRaiseClaims()).toBe(true);
    expect(communityCannotRaiseRegulatory()).toBe(true);
    expect(REDDIT_CONNECTOR_STATUS).toBe("unavailable");
    expect(refuseCommunityImport("no-official-api")).toEqual({ imported: 0, reason: "no-official-api" });
    expect(MIGRATION).toContain("has_role(auth.uid(), 'admin')");
    expect(MIGRATION).toContain("or review_status = 'approved'");
  });
});

describe("persist plan safety", () => {
  it("does not persist UNCHANGED as NEW", () => {
    const store = emptyOperationsStore();
    persistReviewCandidates(
      store,
      [
        {
          kind: "source",
          disposition: "UNCHANGED",
          reviewStatus: "review-required",
          slug: "retatrutide",
          record: {
            sourceType: "pubmed",
            identifier: "1",
            title: "x",
            url: "https://example.test",
            publisher: null,
            publicationDate: null,
            substanceCandidate: "retatrutide",
            rawMetadata: {},
            retrievedAt: "2026-08-29T00:00:00.000Z",
            connector: "pubmed",
            pmid: "1",
            doi: null,
            nctId: null,
            authors: null,
          },
          reason: "unchanged",
          matchConfidence: "exact",
        },
      ],
      { persist: true },
    );
    expect(store.sources).toHaveLength(0);
  });
});

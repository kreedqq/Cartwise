/**
 * Final hardening tests. Fixtures are TEST-ONLY and must never be written to production.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { mapPublicLexicon } from "@/lib/peptide/lexicon/mapPublicLexicon";
import { isPublicSource, isPublicStudy } from "@/lib/peptide/lexicon/publicVisibility";
import { publicBundleFromSeeds, tablesFromPublicBundle } from "@/lib/peptide/lexicon/seedBundle";
import { resolvePublicLexicon } from "@/lib/peptide/lexicon/resolvePublicLexicon";
import { failingPublicSelectClient, mockPublicSelectClient } from "@/lib/peptide/lexicon/fetchPublicLexicon";
import { compareResearchSnapshots } from "@/lib/peptide/persistence/dualRead/compare";
import { postgresBundleFromSeeds } from "@/lib/peptide/persistence/dualRead/bundle";
import { normalizeLegacyResearch } from "@/lib/peptide/persistence/dualRead/normalizeLegacy";
import { normalizePostgresResearch } from "@/lib/peptide/persistence/dualRead/normalizePostgres";
import { publicLexiconMixesReads, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";
import { cannotMergeSlugs } from "@/lib/peptide/research/updateEngine/matchIdentity";
import {
  detectSourceChange,
  persistTouchesReviewStatus,
  preservedWorkflowStatus,
  scientificSourceFieldsChanged,
} from "@/lib/peptide/research/updateEngine/changeDetection";
import {
  applySourceReview,
  emptyOperationsStore,
  persistReviewCandidates,
  startPersistedRun,
} from "@/lib/peptide/research/operations";
import { resetOperationsUuidSeq } from "@/lib/peptide/research/operations/ids";
import { OFFICIAL_CONNECTOR_ACCESS } from "@/lib/peptide/research/operations/officialAccess";
import { scientificAdapter } from "@/lib/peptide/research/updateEngine";
import type { ConnectorSourceRecord, ReviewCandidate } from "@/lib/peptide/research/updateEngine/types";

const POSTGRES_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/research/operations/postgres.ts"), "utf8");
const DETAIL_SRC = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexiconDetail.tsx"), "utf8");
const PERSIST_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/research/operations/persist.ts"), "utf8");

const RETA_PUBMED = {
  pmid: "39325560",
  title: "Retatrutide, a GIP, GLP-1 and glucagon receptor agonist",
  source: "Lancet",
  pubdate: "2024",
  doi: "10.1016/S0140-6736(24)00000-0",
  url: "https://pubmed.ncbi.nlm.nih.gov/39325560/",
};

function pubmedConnector(rows: unknown[]) {
  return scientificAdapter({
    id: "pubmed",
    label: "PubMed",
    retry: { minIntervalMs: 0, maxRetries: 0, backoffMs: 0 },
    search: async () => rows,
  });
}

function sourceRecord(overrides: Partial<ConnectorSourceRecord> = {}): ConnectorSourceRecord {
  return {
    sourceType: "pubmed",
    identifier: "39325560",
    title: RETA_PUBMED.title,
    url: RETA_PUBMED.url,
    publisher: "Lancet",
    publicationDate: "2024",
    substanceCandidate: "retatrutide",
    rawMetadata: {},
    retrievedAt: "2026-08-29T00:00:00.000Z",
    connector: "pubmed",
    pmid: "39325560",
    doi: RETA_PUBMED.doi,
    nctId: null,
    authors: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<ReviewCandidate> & Pick<ReviewCandidate, "disposition">): ReviewCandidate {
  return {
    kind: "source",
    reviewStatus: "review-required",
    slug: "retatrutide",
    record: sourceRecord(),
    reason: "test",
    matchConfidence: "exact",
    ...overrides,
  };
}

describe("update persist review status", () => {
  it("does not treat date-format-only rows as UPDATED", () => {
    expect(
      scientificSourceFieldsChanged(
        { title: RETA_PUBMED.title, publicationDate: "2024-01-01" },
        { title: ` ${RETA_PUBMED.title} `, publicationDate: "2024-01-01T00:00:00Z" },
      ),
    ).toBe(false);
    const change = detectSourceChange(
      sourceRecord({ publicationDate: "2024-01-01T00:00:00Z" }),
      [
        {
          pmid: "39325560",
          doi: RETA_PUBMED.doi,
          nctId: null,
          title: RETA_PUBMED.title,
          publicationDate: "2024-01-01",
          url: RETA_PUBMED.url,
          reviewStatus: "approved",
        },
      ],
      new Set(),
    );
    expect(change.disposition).toBe("UNCHANGED");
    expect(persistTouchesReviewStatus("UNCHANGED")).toBe(false);
    expect(preservedWorkflowStatus("UNCHANGED", "approved")).toBe("approved");
    expect(preservedWorkflowStatus("UNCHANGED", "review-required")).toBe("review-required");
    expect(preservedWorkflowStatus("UNCHANGED", "rejected")).toBe("rejected");
    expect(preservedWorkflowStatus("UPDATED", "approved")).toBe("review-required");
    expect(preservedWorkflowStatus("NEW", null)).toBe("review-required");
    expect(persistTouchesReviewStatus("DUPLICATE")).toBe(false);
  });

  it("keeps approved unchanged through persist and demotes only UPDATED", () => {
    const store = emptyOperationsStore();
    store.sources.push({
      id: "11111111-1111-4111-8111-111111111111",
      sourceType: "pubmed",
      title: RETA_PUBMED.title,
      publisher: "Lancet",
      publicationDate: "2024",
      url: RETA_PUBMED.url,
      doi: RETA_PUBMED.doi,
      pmid: "39325560",
      nctId: null,
      status: "active",
      reviewStatus: "approved",
      connector: "pubmed",
    });
    const unchanged = persistReviewCandidates(store, [candidate({ disposition: "UNCHANGED" })], { persist: true });
    expect(unchanged.updatedSourceIds).toEqual([]);
    expect(store.sources[0]?.reviewStatus).toBe("approved");

    const duplicate = persistReviewCandidates(store, [candidate({ disposition: "DUPLICATE" })], { persist: true });
    expect(duplicate.createdSourceIds).toEqual([]);
    expect(store.sources).toHaveLength(1);
    expect(store.sources[0]?.reviewStatus).toBe("approved");

    const updated = persistReviewCandidates(
      store,
      [candidate({ disposition: "UPDATED", record: sourceRecord({ title: "Retatrutide revised title" }) })],
      { persist: true },
    );
    expect(updated.updatedSourceIds).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(store.sources[0]?.reviewStatus).toBe("review-required");
    expect(store.sources[0]?.previousTitle).toBe(RETA_PUBMED.title);
    expect(updated.claimsAdded).toBe(0);
  });

  it("inserts NEW as review-required and keeps inventory frozen", () => {
    const store = emptyOperationsStore();
    const created = persistReviewCandidates(store, [candidate({ disposition: "NEW" })], { persist: true });
    expect(created.sourcesInserted).toBe(1);
    expect(store.sources[0]?.reviewStatus).toBe("review-required");
    expect(isPublicSource({ nct_id: null, review_status: "review-required" })).toBe(false);
    expect(created.claimsAdded).toBe(0);
    expect(created.evidenceUpgraded).toBe(0);
    expect(created.regulatoryAutoApproved).toBe(0);
  });

  it("does not rewrite review_status for UNCHANGED in postgres persist source", () => {
    expect(POSTGRES_SRC).toContain("UNCHANGED / DUPLICATE ids are never in this list");
    expect(PERSIST_SRC).toContain("Preserve approved / review-required / rejected");
    expect(POSTGRES_SRC).not.toMatch(/from\("claims"\)/);
  });

  it("keeps approved after a live UNCHANGED substance run", async () => {
    resetOperationsUuidSeq();
    const store = emptyOperationsStore();
    store.sources.push({
      id: "22222222-2222-4222-8222-222222222222",
      sourceType: "pubmed",
      title: RETA_PUBMED.title,
      publisher: "Lancet",
      publicationDate: "2024",
      url: RETA_PUBMED.url,
      doi: RETA_PUBMED.doi,
      pmid: "39325560",
      nctId: null,
      status: "active",
      reviewStatus: "approved",
      connector: "pubmed",
    });
    const result = await startPersistedRun({
      store,
      action: "update-substance",
      substanceSlug: "retatrutide",
      connectors: [pubmedConnector([RETA_PUBMED])],
      now: "2026-08-29T14:00:00.000Z",
    });
    expect(result.engine.statistics.sourcesUnchanged).toBe(1);
    expect(result.engine.statistics.sourcesUpdated).toBe(0);
    expect(store.sources[0]?.reviewStatus).toBe("approved");
    expect(result.persist.updatedSourceIds).toEqual([]);
    expect(result.persist.claimsAdded).toBe(0);
  });

  it("appends review_actions on approve without deleting history", () => {
    const store = emptyOperationsStore();
    store.sources.push({
      id: "33333333-3333-4333-8333-333333333333",
      sourceType: "pubmed",
      title: RETA_PUBMED.title,
      publisher: "Lancet",
      publicationDate: "2024",
      url: RETA_PUBMED.url,
      doi: RETA_PUBMED.doi,
      pmid: "39325560",
      nctId: null,
      status: "active",
      reviewStatus: "review-required",
      connector: "pubmed",
    });
    applySourceReview({
      store,
      isAdmin: true,
      adminUserId: "00000000-0000-4000-8000-000000000042",
      id: "33333333-3333-4333-8333-333333333333",
      action: "approve",
      reason: "Verified",
    });
    applySourceReview({
      store,
      isAdmin: true,
      adminUserId: "00000000-0000-4000-8000-000000000042",
      id: "33333333-3333-4333-8333-333333333333",
      action: "reject",
      reason: "Later reject",
    });
    expect(store.reviewActions).toHaveLength(2);
    expect(store.reviewActions[0]?.action).toBe("approve");
    expect(store.reviewActions[1]?.action).toBe("reject");
    expect(PERSIST_SRC).toContain("store.reviewActions.push");
    expect(PERSIST_SRC).not.toMatch(/reviewActions\.(splice|pop|shift)/);
  });
});

describe("citation coverage", () => {
  it("keeps claim sources separate from general source references", () => {
    const bundle = publicBundleFromSeeds();
    const extraId = "approved-without-claim";
    bundle.sources.push({
      id: extraId,
      source_type: "pubmed",
      title: "Approved source without claim_sources",
      publisher: "Test",
      publication_date: "2024",
      access_date: "2026-08-29",
      url: "https://pubmed.ncbi.nlm.nih.gov/28237263/",
      doi: null,
      pmid: "28237263",
      nct_id: null,
      legacy_ids: ["pmid:28237263"],
      review_status: "approved",
    });
    const substanceId = bundle.substances.find((row) => row.slug === "liraglutide")?.id;
    expect(substanceId).toBeTruthy();
    bundle.sourceSubstances.push({
      source_id: extraId,
      substance_id: substanceId!,
      legacy_source_id: "pmid:28237263",
    });
    const mapped = mapPublicLexicon(bundle);
    const profile = mapped.profiles.get("liraglutide");
    expect(profile?.sources.some((row) => row.pmid === "28237263")).toBe(false);
    expect(profile?.sourceReferences?.some((row) => row.pmid === "28237263")).toBe(true);
    expect(DETAIL_SRC).toContain("Scientific Claims");
    expect(DETAIL_SRC).toContain("Claim Sources");
    expect(DETAIL_SRC).toContain("Source References");
    expect(DETAIL_SRC).toContain("Keine Claim-Citation");
  });
});

describe("dual read exclusive modes", () => {
  it("never mixes public UI reads and defaults to postgres", () => {
    expect(publicLexiconMixesReads()).toBe(false);
    expect(researchDbMode({})).toBe("postgres");
    expect(researchDbMode({ VITE_RESEARCH_DB_MODE: "dual" })).toBe("dual");
    expect(researchDbMode({ VITE_RESEARCH_DB_MODE: "legacy" })).toBe("legacy");
  });

  it("treats extra review-required postgres sources as EXTRA not critical", () => {
    const legacy = normalizeLegacyResearch();
    const bundle = postgresBundleFromSeeds();
    bundle.sources.push({
      id: "extra-rr",
      source_type: "pubmed",
      title: "Held review candidate",
      publisher: null,
      publication_date: "2025",
      access_date: null,
      url: "https://pubmed.ncbi.nlm.nih.gov/99999999/",
      doi: null,
      pmid: "99999999",
      nct_id: null,
      legacy_ids: ["pmid:99999999"],
      review_status: "review-required",
    });
    const postgres = normalizePostgresResearch(bundle);
    const report = compareResearchSnapshots(legacy, postgres, { mode: "dual" });
    expect(report.counts.EXTRA).toBeGreaterThan(0);
    expect(report.differences.some((row) => row.family === "source" && row.status === "EXTRA" && row.critical)).toBe(
      false,
    );
    expect(report.verdict).toBe("DUAL_READ_READY");
  });

  it("uses exclusive file fallback on timeout without mixing", async () => {
    const catalog = await resolvePublicLexicon({
      client: failingPublicSelectClient("timeout"),
      mode: "postgres",
      timeoutMs: 40,
    });
    expect(catalog.source).toBe("legacy");
    expect(catalog.fallback?.kind).toBe("timeout");
    expect(catalog.substances).toHaveLength(27);
  });

  it("seed tables remain exclusive postgres when valid", async () => {
    const catalog = await resolvePublicLexicon({
      client: mockPublicSelectClient(tablesFromPublicBundle(publicBundleFromSeeds())),
      mode: "dual",
    });
    expect(catalog.source).toBe("postgres");
    expect(catalog.fallback).toBeNull();
  });
});

describe("identity hudson community connectors", () => {
  it("keeps identity pairs separate and Hudson hidden", () => {
    expect(cannotMergeSlugs("tb-500", "thymosin-beta-4")).toBe(true);
    expect(cannotMergeSlugs("melanotan-ii", "afamelanotide")).toBe(true);
    expect(cannotMergeSlugs("igf-1-lr3", "mecasermin")).toBe(true);
    expect(cannotMergeSlugs("glow-blend", "ghk-cu")).toBe(true);
    expect(cannotMergeSlugs("hcg", "ovitrelle")).toBe(true);
    expect(EXCLUDED_STUDY_NCTS).toEqual(["NCT07487363", "NCT07437560"]);
    expect(isPublicStudy({ nct_id: "NCT07487363", substanceCount: 1, review_status: "approved" })).toBe(false);
    expect(isPublicSource({ nct_id: "NCT07437560", review_status: "approved" })).toBe(false);
  });

  it("keeps reddit bfarm mhra nmpa unavailable", () => {
    expect(OFFICIAL_CONNECTOR_ACCESS.reddit.availability).toBe("unavailable");
    expect(OFFICIAL_CONNECTOR_ACCESS.bfarm.availability).toBe("unavailable");
    expect(OFFICIAL_CONNECTOR_ACCESS.mhra.availability).toBe("unavailable");
    expect(OFFICIAL_CONNECTOR_ACCESS.nmpa.availability).toBe("unavailable");
  });
});

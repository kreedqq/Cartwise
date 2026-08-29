/**
 * Block 4 final operations tests.
 * Fixtures below are TEST FIXTURES only and must never be written to production.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isPublicCommunityReport } from "@/lib/peptide/lexicon/publicVisibility";
import { fetchPublicLexicon, mockPublicSelectClient } from "@/lib/peptide/lexicon/fetchPublicLexicon";
import { tablesFromPublicBundle, publicBundleFromSeeds } from "@/lib/peptide/lexicon/seedBundle";
import { OFFICIAL_CONNECTOR_ACCESS } from "@/lib/peptide/research/operations/officialAccess";
import {
  OPERATIONS_CRON_ENABLED,
  OPERATIONS_PRODUCTION_WRITE,
  emptyOperationsStore,
  persistReviewCandidates,
  startPersistedRun,
} from "@/lib/peptide/research/operations";
import { scientificAdapter } from "@/lib/peptide/research/updateEngine";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";

const MIGRATION = readFileSync(resolve(process.cwd(), "supabase/migrations/0031_research_operations.sql"), "utf8");
const POSTGRES_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/research/operations/postgres.ts"), "utf8");
const DETAIL_SRC = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexiconDetail.tsx"), "utf8");
const FETCH_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/lexicon/fetchPublicLexicon.ts"), "utf8");
const PANEL_SRC = readFileSync(resolve(process.cwd(), "src/components/admin/ResearchOperationsPanel.tsx"), "utf8");

describe("block 4 migration 0031", () => {
  it("is schema-only and does not mutate science or shop rows", () => {
    expect(MIGRATION).toContain("Schema-only");
    expect(MIGRATION).toContain("community_reports");
    expect(MIGRATION).toContain("research_connector_health");
    expect(MIGRATION).toContain("research_runs_one_active_full");
    expect(MIGRATION).toContain("research_runs_select_admin");
    expect(MIGRATION).not.toMatch(/\bupdate public\.(sources|studies|claims|evidence_assessments|regulatory_records)\b/i);
    expect(MIGRATION).not.toMatch(/\binsert into public\.(sources|studies|claims)\b/i);
    expect(MIGRATION).not.toMatch(/\bpublic\.(products|carts|orders)\b/);
    expect(OPERATIONS_PRODUCTION_WRITE).toBe(false);
    expect(OPERATIONS_CRON_ENABLED).toBe(false);
  });
});

describe("official connector access", () => {
  it("keeps reddit, bfarm, mhra, and nmpa unavailable without scraping", () => {
    expect(OFFICIAL_CONNECTOR_ACCESS.reddit.availability).toBe("unavailable");
    expect(OFFICIAL_CONNECTOR_ACCESS.bfarm.availability).toBe("unavailable");
    expect(OFFICIAL_CONNECTOR_ACCESS.mhra.availability).toBe("unavailable");
    expect(OFFICIAL_CONNECTOR_ACCESS.nmpa.availability).toBe("unavailable");
    expect(OFFICIAL_CONNECTOR_ACCESS.pubmed.availability).toBe("available");
    expect(OFFICIAL_CONNECTOR_ACCESS.clinicaltrials.availability).toBe("available");
    expect(OFFICIAL_CONNECTOR_ACCESS.fda.availability).toBe("available");
    expect(OFFICIAL_CONNECTOR_ACCESS.ema.availability).toBe("available");
    expect(OFFICIAL_CONNECTOR_ACCESS.reddit.reason.toLowerCase()).toContain("scraping");
  });
});

describe("community public visibility", () => {
  it("hides review-required community and never mixes with science", () => {
    expect(isPublicCommunityReport({ review_status: "review-required" })).toBe(false);
    expect(isPublicCommunityReport({ review_status: "rejected" })).toBe(false);
    expect(isPublicCommunityReport({ review_status: "approved" })).toBe(true);
    expect(DETAIL_SRC).toContain("Scientific Research");
    expect(DETAIL_SRC).toContain("Community Experience");
    expect(DETAIL_SRC).toContain("Keine freigegebenen Community-Berichte");
  });
});

describe("public lexicon community fetch", () => {
  it("keeps exclusive science fetch if community_reports is missing", async () => {
    const tables = tablesFromPublicBundle(publicBundleFromSeeds());
    delete tables.community_reports;
    const result = await fetchPublicLexicon(mockPublicSelectClient(tables));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bundle.communityReports).toEqual([]);
  });

  it("does not fail the science bundle when community_reports is absent from Promise.all", () => {
    expect(FETCH_SRC).toContain("community_reports");
    expect(FETCH_SRC).toContain("keep science bundle exclusive");
  });
});

describe("postgres persist safety", () => {
  it("writes only review-required candidates and never claims/evidence/regulatory", () => {
    expect(POSTGRES_SRC).toContain('review_status: "review-required"');
    expect(POSTGRES_SRC).not.toMatch(/from\("claims"\)/);
    expect(POSTGRES_SRC).not.toMatch(/from\("evidence_assessments"\)/);
    expect(POSTGRES_SRC).not.toMatch(/from\("regulatory_records"\)/);
    expect(POSTGRES_SRC).not.toMatch(/from\("products"\)/);
    expect(POSTGRES_SRC).not.toMatch(/select\("\*"\)/);
  });

  it("paginates run history with explicit columns", () => {
    expect(POSTGRES_SRC).toContain(".range(from, from + pageSize - 1)");
    expect(PANEL_SRC).toContain("Run ID");
    expect(PANEL_SRC).toContain("Start");
    expect(PANEL_SRC).toContain("End");
  });
});

describe("persist candidate ids", () => {
  it("records created source ids as review-required without changing inventory", async () => {
    const store = emptyOperationsStore();
    const result = await startPersistedRun({
      store,
      action: "update-combined",
      substanceSlug: "retatrutide",
      connector: "pubmed",
      connectors: [
        scientificAdapter({
          id: "pubmed",
          label: "PubMed",
          retry: { minIntervalMs: 0, maxRetries: 0, backoffMs: 0 },
          search: async () => [
            {
              pmid: "39325560",
              title: "Retatrutide fixture",
              source: "Lancet",
              pubdate: "2024",
              doi: "10.1016/S0140-6736(24)00000-0",
              url: "https://pubmed.ncbi.nlm.nih.gov/39325560/",
            },
          ],
        }),
      ],
      now: "2026-08-29T12:00:00.000Z",
    });
    expect(result.persist.claimsAdded).toBe(0);
    expect(result.persist.evidenceUpgraded).toBe(0);
    expect(result.persist.regulatoryAutoApproved).toBe(0);
    expect(result.persist.createdSourceIds.length).toBe(result.persist.sourcesInserted);
    expect(store.inventory.claims).toBe(294);
    expect(EXCLUDED_STUDY_NCTS).toContain("NCT07487363");
    persistReviewCandidates(store, [], { persist: true });
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { appendReviewHistory, buildReviewActionDraft, nextWorkflowStatus } from "@/lib/peptide/adminResearch";
import { isPublicSource, isPublicStudy } from "@/lib/peptide/lexicon";
import { identityMustStaySeparate } from "@/lib/peptide/research/sourceValidation";
import {
  buildBatch03IntakePlan,
  type Batch03AnalysisFile,
} from "@/lib/peptide/research/batch03Intake";
import {
  adminVisibleSources,
  adminVisibleStudies,
  analyzeMigration0030,
  canSelectSourceRow,
  canSelectStudyRow,
  createSeededPersistStore,
  persistBatch03Intake,
  publicVisibleSources,
  publicVisibleStudies,
  renderBatch03IntakeSql,
} from "@/lib/peptide/research/batch03Persist";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";

const ANALYSIS = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/research/cache/fetched/batch03/analysis.json"), "utf8"),
) as Batch03AnalysisFile;
const MIGRATION_0030 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0030_research_source_study_review_intake.sql"),
  "utf8",
);

function plan() {
  return buildBatch03IntakePlan(ANALYSIS);
}

describe("phase 16 review intake persistence", () => {
  it("keeps review_status separate from lifecycle and clinical status", () => {
    const meta = analyzeMigration0030(MIGRATION_0030);
    expect(meta.addsSourceReviewStatus).toBe(true);
    expect(meta.addsStudyReviewStatus).toBe(true);
    expect(meta.defaultReviewRequired).toBe(true);
    expect(meta.backfillsApproved).toBe(true);
    expect(meta.noDropTable).toBe(true);
    expect(meta.noTruncate).toBe(true);
    expect(meta.noDeleteFrom).toBe(true);
    expect(meta.noShopTables).toBe(true);
    expect(meta.extendsReviewActions).toBe(true);
    expect(meta.anonRevoke).toBe(true);
    expect(meta.sourcePolicyUsesReviewStatus).toBe(true);
    expect(meta.studyPolicyIgnoresClinicalStatus).toBe(true);
    expect(meta.noAutoImport).toBe(true);
    expect(MIGRATION_0030).not.toMatch(/insert into public\.claims/i);
    expect(MIGRATION_0030).toContain("intervention");
    expect(MIGRATION_0030).toContain("condition");
    expect(MIGRATION_0030).toContain("sources_review_status_idx");
    expect(MIGRATION_0030).toContain("studies_review_status_idx");
  });

  it("imports 104 sources and 36 studies as review-required without claims or evidence changes", () => {
    const store = createSeededPersistStore();
    const beforeSources = store.sources.length;
    const beforeStudies = store.studies.length;
    const evidenceRequired = store.evidence.filter((row) => row.reviewStatus === "review-required").length;
    const first = persistBatch03Intake({ plan: plan(), store });
    expect(first.result.rolledBack).toBe(false);
    expect(first.result.productionWrite).toBe(false);
    expect(first.result.claimsCreated).toBe(0);
    expect(first.result.evidenceChanged).toBe(0);
    expect(first.result.regulatoryChanged).toBe(0);
    expect(first.result.sourcesInserted).toBe(104);
    expect(first.result.studiesInserted).toBe(36);
    expect(first.result.sourcesLinked).toBe(108);
    expect(first.store.sources.length).toBe(beforeSources + 104);
    expect(first.store.studies.length).toBe(beforeStudies + 36);
    expect(first.store.sources.filter((row) => row.reviewStatus === "review-required")).toHaveLength(104);
    expect(first.store.studies.filter((row) => row.reviewStatus === "review-required")).toHaveLength(36);
    expect(first.store.evidence.filter((row) => row.reviewStatus === "review-required")).toHaveLength(evidenceRequired);
    expect(first.store.productSubstances).toHaveLength(93);
    expect(first.store.sources.every((row) => row.reviewStatus !== "review-required" || row.status === "active")).toBe(true);
    expect(
      first.store.studies.some(
        (row) => row.reviewStatus === "review-required" && Boolean(row.status) && row.status !== "approved",
      ),
    ).toBe(true);
  });

  it("is idempotent on a second persist", () => {
    const store = createSeededPersistStore();
    const first = persistBatch03Intake({ plan: plan(), store });
    const second = persistBatch03Intake({ plan: plan(), store: first.store });
    expect(second.result.sourcesInserted).toBe(0);
    expect(second.result.studiesInserted).toBe(0);
    expect(second.store.sources.length).toBe(first.store.sources.length);
    expect(second.store.studies.length).toBe(first.store.studies.length);
    expect(second.store.sourceSubstances.length).toBe(first.store.sourceSubstances.length);
  });

  it("rolls back the store when persist fails", () => {
    const store = createSeededPersistStore();
    const failed = persistBatch03Intake({ plan: plan(), store, fail: true });
    expect(failed.result.rolledBack).toBe(true);
    expect(failed.store.sources.length).toBe(store.sources.length);
    expect(failed.store.studies.length).toBe(store.studies.length);
  });

  it("links relationship-only PMIDs without duplicating the source", () => {
    const store = createSeededPersistStore();
    const pmids = ["42578445", "42419792", "40353578", "40544433"];
    const before = pmids.map((pmid) => store.sources.filter((row) => row.pmid === pmid).length);
    expect(before.every((count) => count === 1)).toBe(true);
    const after = persistBatch03Intake({ plan: plan(), store });
    for (const pmid of pmids) {
      expect(after.store.sources.filter((row) => row.pmid === pmid)).toHaveLength(1);
    }
    const ipamorelin = after.store.substances.find((row) => row.slug === "ipamorelin")?.id;
    const source = after.store.sources.find((row) => row.pmid === "42578445");
    expect(ipamorelin).toBeTruthy();
    expect(
      after.store.sourceSubstances.some((row) => row.sourceId === source?.id && row.substanceId === ipamorelin),
    ).toBe(true);
  });

  it("never persists Hudson NCTs", () => {
    const intake = plan();
    intake.sources.import.push({
      candidateId: "tb-500:clinical_trial:NCT07487363",
      slug: "tb-500",
      title: "Hudson Biotech TB-500",
      url: "https://clinicaltrials.gov/study/NCT07487363",
      sourceType: "clinical_trial",
      identifier: "NCT07487363",
      pmid: null,
      doi: null,
      nctId: EXCLUDED_STUDY_NCTS[0],
      publicationDate: null,
      publisher: "ClinicalTrials.gov",
      connector: "clinicaltrials.gov-v2",
      reviewStatus: "review-required",
      disposition: "import",
      reason: "injected",
    });
    intake.studies.import.push({
      candidateId: "melanotan-ii:study:NCT07437560",
      slug: "melanotan-ii",
      nctId: EXCLUDED_STUDY_NCTS[1],
      title: "Hudson Biotech melanotan",
      sponsor: "Hudson Biotech",
      intervention: "Melanotan II",
      condition: "tanning",
      phase: "NA",
      status: "RECRUITING",
      url: "https://clinicaltrials.gov/study/NCT07437560",
      lastUpdate: null,
      reviewStatus: "review-required",
      disposition: "import",
      reason: "injected",
    });
    const after = persistBatch03Intake({ plan: intake, store: createSeededPersistStore() });
    expect(after.store.sources.some((row) => row.nctId === EXCLUDED_STUDY_NCTS[0])).toBe(false);
    expect(after.store.studies.some((row) => row.nctId === EXCLUDED_STUDY_NCTS[1])).toBe(false);
    expect(after.result.sourcesExcludedHudson).toBeGreaterThan(0);
    expect(after.result.studiesExcludedHudson).toBeGreaterThan(0);
  });

  it("keeps identity pairs separate", () => {
    expect(identityMustStaySeparate("tb-500", "thymosin-beta-4")).toBe(true);
    expect(identityMustStaySeparate("melanotan-ii", "afamelanotide")).toBe(true);
    expect(identityMustStaySeparate("igf-1-lr3", "mecasermin")).toBe(true);
    const intake = plan();
    intake.sources.import.push({
      candidateId: "glow-blend:pubmed:1",
      slug: "glow-blend",
      title: "Glow blend marketing note",
      url: "https://pubmed.ncbi.nlm.nih.gov/1/",
      sourceType: "pubmed",
      identifier: "PMID 1",
      pmid: "1",
      doi: null,
      nctId: null,
      publicationDate: null,
      publisher: "NCBI PubMed",
      connector: "ncbi-eutils",
      reviewStatus: "review-required",
      disposition: "import",
      reason: "injected",
    });
    const after = persistBatch03Intake({ plan: intake, store: createSeededPersistStore() });
    expect(after.store.sources.some((row) => row.pmid === "1")).toBe(false);
    expect(after.result.sourcesRejectedIdentity).toBeGreaterThan(0);
  });

  it("hides review-required rows from public and authenticated non-admin views", () => {
    const after = persistBatch03Intake({ plan: plan(), store: createSeededPersistStore() });
    const reviewSource = after.store.sources.find((row) => row.reviewStatus === "review-required");
    const reviewStudy = after.store.studies.find((row) => row.reviewStatus === "review-required");
    expect(reviewSource).toBeTruthy();
    expect(reviewStudy).toBeTruthy();
    expect(isPublicSource({ nct_id: reviewSource!.nctId, review_status: reviewSource!.reviewStatus })).toBe(false);
    expect(
      isPublicStudy({
        nct_id: reviewStudy!.nctId,
        substanceCount: 1,
        review_status: reviewStudy!.reviewStatus,
      }),
    ).toBe(false);
    expect(publicVisibleSources(after.store).every((row) => row.reviewStatus === "approved")).toBe(true);
    expect(publicVisibleStudies(after.store).every((row) => row.reviewStatus === "approved")).toBe(true);
    expect(publicVisibleSources(after.store).some((row) => row.id === reviewSource!.id)).toBe(false);
    expect(publicVisibleStudies(after.store).some((row) => row.id === reviewStudy!.id)).toBe(false);
    expect(adminVisibleSources(after.store).some((row) => row.id === reviewSource!.id)).toBe(true);
    expect(adminVisibleStudies(after.store).some((row) => row.id === reviewStudy!.id)).toBe(true);
    expect(canSelectSourceRow("anon", reviewSource!)).toBe(false);
    expect(canSelectSourceRow("authenticated", reviewSource!)).toBe(false);
    expect(canSelectSourceRow("admin", reviewSource!)).toBe(true);
    expect(canSelectStudyRow("authenticated", { status: "RECRUITING", reviewStatus: "review-required" })).toBe(false);
    expect(canSelectStudyRow("authenticated", { status: "RECRUITING", reviewStatus: "approved" })).toBe(true);
    expect(canSelectSourceRow("authenticated", { status: "active", reviewStatus: "approved" })).toBe(true);
  });

  it("builds append-only source/study review actions without executing them", () => {
    const draft = buildReviewActionDraft({
      entityType: "source",
      entityId: "source-1",
      entityStableKey: "pmid:39325560",
      action: "approve",
      previousStatus: "review-required",
      reason: "Admin approved after 0030 persist setup.",
      adminUserId: "admin-1",
    });
    expect(nextWorkflowStatus("approve")).toBe("approved");
    expect(draft.newStatus).toBe("approved");
    const rejected = buildReviewActionDraft({
      entityType: "study",
      entityId: "study-1",
      entityStableKey: "NCT06065540",
      action: "reject",
      previousStatus: "review-required",
      reason: "Admin rejected after protocol review.",
      adminUserId: "admin-1",
    });
    const history = appendReviewHistory([draft], rejected);
    expect(history).toHaveLength(2);
    expect(MIGRATION_0030).not.toMatch(/review_actions_update/);
    expect(MIGRATION_0030).not.toMatch(/review_actions_delete/);
  });

  it("renders idempotent import SQL that never auto-approves", () => {
    const sql = renderBatch03IntakeSql(plan());
    expect(sql.startsWith("-- Batch 03 review intake import")).toBe(true);
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(sql).toContain("'review-required'");
    expect(sql).not.toMatch(/insert into public\.sources[\s\S]{0,400}'approved'/i);
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toContain("NCT07487363");
    expect(sql).not.toContain("NCT07437560");
    expect(sql).toContain("42578445");
    expect(sql).toContain("on conflict (pmid) where pmid is not null do nothing;");
    expect(sql).toContain("on conflict (nct_id) do nothing;");
    expect(sql.match(/insert into public\.sources /g)?.length).toBe(104);
    expect(sql.match(/insert into public\.studies /g)?.length).toBe(36);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  appendReviewHistory,
  buildReviewActionDraft,
  emptyDashboard,
} from "@/lib/peptide/adminResearch";
import {
  isPublicSource,
  isPublicStudy,
  mapPublicLexicon,
  publicSources,
  publicStudies,
  publicBundleFromSeeds,
} from "@/lib/peptide/lexicon";
import { identityMustStaySeparate } from "@/lib/peptide/research/sourceValidation";
import {
  BATCH_03_MIGRATION_REQUIRED,
  BATCH03_PRODUCTION_IMPORT_PENDING,
  buildBatch03IntakePlan,
  identityIssueForCandidate,
  intakeQueueItems,
  isIntakePlaceholderId,
  type Batch03AnalysisFile,
} from "@/lib/peptide/research/batch03Intake";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";

const ANALYSIS_PATH = resolve(process.cwd(), "src/research/cache/fetched/batch03/analysis.json");
const MIGRATION_0030 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0030_research_source_study_review_intake.sql"),
  "utf8",
);
const ADMIN_PAGE = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminResearch.tsx"), "utf8");
const SERVICE = readFileSync(resolve(process.cwd(), "src/services/adminResearch.ts"), "utf8");
const FETCH_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/lexicon/fetchPublicLexicon.ts"), "utf8");
const VISIBILITY_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/lexicon/publicVisibility.ts"), "utf8");

function analysis(): Batch03AnalysisFile {
  return JSON.parse(readFileSync(ANALYSIS_PATH, "utf8")) as Batch03AnalysisFile;
}

describe("phase 15 batch 03 review intake", () => {
  it("plans 108 source and 36 study candidates without writing production or creating claims", () => {
    expect(existsSync(ANALYSIS_PATH)).toBe(true);
    const plan = buildBatch03IntakePlan(analysis());
    expect(plan.productionWrite).toBe(false);
    expect(plan.claimsAdded).toBe(0);
    expect(plan.evidenceChanges).toBe(0);
    expect(plan.regulatoryChanges).toBe(0);
    expect(plan.migrationRequired).toBe(BATCH_03_MIGRATION_REQUIRED);
    expect(plan.sources.candidates).toBe(108);
    expect(plan.studies.candidates).toBe(36);
    const sourceBreakdown = {
      import: plan.sources.import.length,
      duplicate: plan.sources.duplicate.length,
      relationship: plan.sources.relationship.length,
      rejected: plan.sources.rejected.length,
      hudson: plan.sources.hudson.length,
    };
    const studyBreakdown = {
      import: plan.studies.import.length,
      duplicate: plan.studies.duplicate.length,
      relationship: plan.studies.relationship.length,
      rejected: plan.studies.rejected.length,
      hudson: plan.studies.hudson.length,
    };
    expect(sourceBreakdown.hudson).toBe(0);
    expect(studyBreakdown.hudson).toBe(0);
    expect(sourceBreakdown.import + sourceBreakdown.duplicate + sourceBreakdown.relationship + sourceBreakdown.rejected + sourceBreakdown.hudson).toBe(108);
    expect(studyBreakdown.import + studyBreakdown.duplicate + studyBreakdown.relationship + studyBreakdown.rejected + studyBreakdown.hudson).toBe(36);
    expect(sourceBreakdown).toEqual({ import: 104, duplicate: 0, relationship: 4, rejected: 0, hudson: 0 });
    expect(studyBreakdown).toEqual({ import: 36, duplicate: 0, relationship: 0, rejected: 0, hudson: 0 });
    expect(plan.sources.relationship.every((row) => row.reason.includes("new-substance-link"))).toBe(true);
    expect(plan.sources.relationship.map((row) => row.candidateId).sort()).toEqual([
      "ipamorelin:pubmed:42578445",
      "orforglipron:pubmed:42419792",
      "semaglutide:pubmed:40353578",
      "semaglutide:pubmed:40544433",
    ]);
    expect(plan.sources.import.every((row) => row.reviewStatus === "review-required")).toBe(true);
    expect(plan.studies.import.every((row) => row.reviewStatus === "review-required")).toBe(true);
    expect(plan.sources.import.every((row) => row.url && row.title && (row.pmid || row.nctId))).toBe(true);
    expect(plan.studies.import.every((row) => row.nctId && row.intervention && row.condition && row.sponsor)).toBe(true);
    expect(BATCH03_PRODUCTION_IMPORT_PENDING).toBe(false);
  });

  it("does not duplicate published PMIDs, DOIs, or NCTs", () => {
    const plan = buildBatch03IntakePlan(analysis());
    expect(plan.sources.import.every((row) => row.reason !== "pmid-exists")).toBe(true);
    const duplicatePmids = plan.sources.duplicate.filter((row) => row.reason.includes("pmid") || row.reason.includes("already-in-published"));
    expect(plan.sources.candidates).toBe(108);
    const importedPmids = plan.sources.import.map((row) => row.pmid).filter(Boolean);
    expect(new Set(importedPmids).size).toBe(importedPmids.length);
    const importedNcts = [...plan.sources.import.map((row) => row.nctId), ...plan.studies.import.map((row) => row.nctId)].filter(Boolean);
    expect(importedNcts.every((nct) => !duplicatePmids.some((row) => row.nctId === nct))).toBe(true);
  });

  it("never intakes Hudson NCTs even when injected", () => {
    const seeded = analysis();
    seeded.sourcesAccepted = [
      ...(seeded.sourcesAccepted ?? []),
      {
        slug: "tb-500",
        kind: "clinical_trial",
        id: EXCLUDED_STUDY_NCTS[0],
        title: "Hudson Biotech TB-500 study",
        alreadyPublished: false,
        publication: "review-required",
      },
    ];
    seeded.studiesAccepted = [
      ...(seeded.studiesAccepted ?? []),
      {
        slug: "melanotan-ii",
        nctId: EXCLUDED_STUDY_NCTS[1],
        title: "Hudson Biotech melanotan",
        sponsor: "Hudson Biotech",
        intervention: "Melanotan II",
        condition: "tanning",
        alreadyPublished: false,
        publication: "review-required",
      },
    ];
    const plan = buildBatch03IntakePlan(seeded);
    expect(plan.sources.hudson.some((row) => row.nctId === EXCLUDED_STUDY_NCTS[0])).toBe(true);
    expect(plan.studies.hudson.some((row) => row.nctId === EXCLUDED_STUDY_NCTS[1])).toBe(true);
    expect(plan.sources.import.some((row) => row.nctId === EXCLUDED_STUDY_NCTS[0])).toBe(false);
    expect(plan.studies.import.some((row) => row.nctId === EXCLUDED_STUDY_NCTS[1])).toBe(false);
  });

  it("keeps identity pairs separate and rejects glow-blend as an INN target", () => {
    expect(identityMustStaySeparate("tb-500", "thymosin-beta-4")).toBe(true);
    expect(identityMustStaySeparate("melanotan-ii", "afamelanotide")).toBe(true);
    expect(identityMustStaySeparate("igf-1-lr3", "mecasermin")).toBe(true);
    expect(identityIssueForCandidate("glow-blend", "any title")).toMatch(/blend/i);
    expect(identityIssueForCandidate("melanotan-ii", "Afamelanotide (Scenesse) phototoxicity")).toMatch(/afamelanotide/i);
    expect(identityIssueForCandidate("tb-500", "Thymosin Beta-4 in cardiac repair")).toMatch(/Thymosin Beta-4/);
    const plan = buildBatch03IntakePlan(analysis());
    expect(plan.sources.import.some((row) => row.slug === "glow-blend")).toBe(false);
    expect(plan.studies.import.some((row) => row.slug === "glow-blend")).toBe(false);
  });

  it("exposes import candidates as review-required admin queue items that are not persisted", () => {
    const plan = buildBatch03IntakePlan(analysis());
    const items = intakeQueueItems(plan);
    expect(items.every((item) => item.status === "review-required")).toBe(true);
    expect(items.every((item) => isIntakePlaceholderId(item.id))).toBe(true);
    expect(items.filter((item) => item.kind === "source")).toHaveLength(104);
    expect(items.filter((item) => item.kind === "study")).toHaveLength(36);
    expect(ADMIN_PAGE).toContain('{ id: "source", label: "Sources" }');
    expect(ADMIN_PAGE).toContain('{ id: "study", label: "Studies" }');
    expect(ADMIN_PAGE).toContain("Source Review");
    expect(ADMIN_PAGE).toContain("Study Review");
    expect(ADMIN_PAGE).toContain("MIGRATION_REQUIRED");
    expect(ADMIN_PAGE).toContain("detail.intervention");
    expect(ADMIN_PAGE).toContain("detail.connector");
    expect(SERVICE).toContain("isIntakePlaceholderId");
    expect(SERVICE).toContain("MIGRATION_REQUIRED");
    expect(SERVICE).not.toMatch(/from\("review_actions"\)\.update/);
    expect(SERVICE).not.toMatch(/from\("review_actions"\)\.delete/);
  });

  it("hides review-required sources and studies from the public lexicon", () => {
    expect(isPublicSource({ nct_id: null, review_status: "review-required" })).toBe(false);
    expect(isPublicSource({ nct_id: null, review_status: "approved" })).toBe(true);
    expect(isPublicSource({ nct_id: null })).toBe(true);
    expect(isPublicStudy({ nct_id: "NCT06065540", substanceCount: 1, review_status: "review-required" })).toBe(false);
    expect(isPublicStudy({ nct_id: "NCT06065540", substanceCount: 1, review_status: "approved" })).toBe(true);
    expect(isPublicStudy({ nct_id: EXCLUDED_STUDY_NCTS[0], substanceCount: 1, review_status: "approved" })).toBe(false);

    const bundle = publicBundleFromSeeds();
    const leaked = structuredClone(bundle);
    leaked.sources.push({
      id: "leak-source",
      source_type: "pubmed",
      title: "BATCH03 LEAKED SOURCE",
      publisher: "NCBI PubMed",
      publication_date: "2026",
      access_date: "2026-08-29",
      url: "https://pubmed.ncbi.nlm.nih.gov/00000000/",
      doi: null,
      pmid: "00000000",
      nct_id: null,
      legacy_ids: ["leak-source"],
      review_status: "review-required",
    });
    leaked.sourceSubstances.push({
      source_id: "leak-source",
      substance_id: leaked.substances.find((row) => row.slug === "retatrutide")?.id ?? "retatrutide",
      legacy_source_id: "leak-source",
    });
    leaked.studies.push({
      id: "leak-study",
      nct_id: "NCT07357415",
      title: "BATCH03 LEAKED STUDY",
      sponsor: "Leak",
      phase: "PHASE3",
      status: "RECRUITING",
      enrollment: null,
      start_date: null,
      completion_date: null,
      last_updated: null,
      has_results: false,
      source_url: "https://clinicaltrials.gov/study/NCT07357415",
      review_status: "review-required",
      intervention: "Retatrutide",
      condition: "Obesity",
    });
    leaked.studySubstances.push({
      study_id: "leak-study",
      substance_id: leaked.substances.find((row) => row.slug === "retatrutide")?.id ?? "retatrutide",
    });

    expect(publicSources(leaked).some((row) => row.id === "leak-source")).toBe(false);
    expect(publicStudies(leaked).some((row) => row.id === "leak-study")).toBe(false);
    const mapped = mapPublicLexicon(leaked);
    const blob = JSON.stringify(mapped.profiles.get("retatrutide"));
    expect(blob).not.toContain("BATCH03 LEAKED SOURCE");
    expect(blob).not.toContain("BATCH03 LEAKED STUDY");
    expect(FETCH_SRC).toContain('eq: { review_status: "approved" }');
    expect(VISIBILITY_SRC).toContain("isPublicSource");
  });

  it("documents 0030 review_status RLS without DROP/DELETE/TRUNCATE", () => {
    expect(MIGRATION_0030).toContain("Applied to cartwise-prod");
    expect(MIGRATION_0030).toContain("MIGRATION_REQUIRED");
    expect(MIGRATION_0030).toContain("review_status");
    expect(MIGRATION_0030).toContain("review_status = 'approved'");
    expect(MIGRATION_0030).toContain("'source'");
    expect(MIGRATION_0030).toContain("'study'");
    expect(MIGRATION_0030).not.toMatch(/\bDROP TABLE\b/i);
    expect(MIGRATION_0030).not.toMatch(/^\s*TRUNCATE\b/im);
    expect(MIGRATION_0030).not.toMatch(/\bDELETE FROM\b/i);
    expect(emptyDashboard("postgres").sourcesReviewRequired).toBe(0);
  });

  it("builds append-only source and study review actions without executing them", () => {
    const draft = buildReviewActionDraft({
      entityType: "source",
      entityId: "00000000-0000-0000-0000-000000000001",
      entityStableKey: "pmid:39325560",
      action: "approve",
      previousStatus: "review-required",
      reason: "Admin reviewed PMID 39325560 against the official record.",
      adminUserId: "admin-1",
    });
    expect(draft.entityType).toBe("source");
    expect(draft.newStatus).toBe("approved");
    const studyDraft = buildReviewActionDraft({
      entityType: "study",
      entityId: "00000000-0000-0000-0000-000000000002",
      entityStableKey: "NCT06065540",
      action: "reject",
      previousStatus: "review-required",
      reason: "Admin rejected after protocol review.",
      adminUserId: "admin-1",
    });
    expect(studyDraft.newStatus).toBe("rejected");
    const history = appendReviewHistory([draft], studyDraft);
    expect(history).toHaveLength(2);
    expect(SERVICE).toContain('input.kind === "source"');
    expect(SERVICE).toContain('input.kind === "study"');
    expect(SERVICE).toContain(".insert(");
  });
});

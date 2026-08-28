import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ADMIN_RESEARCH_PAGE_SIZE,
  ADMIN_REVIEW_ACTIONS,
  RESEARCH_UPDATES_TABLE_EXISTS,
  appendReviewHistory,
  assertAdminCanWriteReview,
  buildReviewActionDraft,
  claimIsTraceable,
  communityCannotAppearAsScientificEvidence,
  emptyDashboard,
  legacyAdminFallbackDashboard,
  legacyAdminFallbackQueue,
  nextWorkflowStatus,
  openSubstanceReviews,
} from "@/lib/peptide/adminResearch";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { publishedScienceSeed } from "@/lib/peptide/persistence/publishedScienceSeed";
import { lexiconDisplaySource, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { getPublishedProfile, listPublishedProfiles } from "@/lib/peptide/profiles";

const MIGRATION_0026 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0026_research_claims_and_evidence.sql"),
  "utf8",
);
const MIGRATION_0027 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0027_research_regulatory_and_review.sql"),
  "utf8",
);
const MIGRATION_0028 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0028_research_evidence_assessments_select_approved.sql"),
  "utf8",
);
const ADMIN_PAGE = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminResearch.tsx"), "utf8");
const LEXICON = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexicon.tsx"), "utf8");
const DETAIL = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexiconDetail.tsx"), "utf8");
const SERVICE = readFileSync(resolve(process.cwd(), "src/services/adminResearch.ts"), "utf8");

describe("phase 8 admin postgres workflow", () => {
  it("maps implemented review actions onto existing workflow statuses", () => {
    expect(nextWorkflowStatus("approve")).toBe("approved");
    expect(nextWorkflowStatus("publish")).toBe("approved");
    expect(nextWorkflowStatus("reject")).toBe("rejected");
    expect(nextWorkflowStatus("request_review")).toBe("review-required");
    expect(nextWorkflowStatus("unpublish")).toBe("review-required");
    expect(ADMIN_REVIEW_ACTIONS).not.toContain("edit");
  });

  it("rejects non-admin writes and requires a reason", () => {
    expect(() => assertAdminCanWriteReview(false)).toThrow(/Administratoren/);
    expect(() => assertAdminCanWriteReview(true)).not.toThrow();
    expect(() =>
      buildReviewActionDraft({
        entityType: "claim",
        entityId: "c1",
        entityStableKey: "retatrutide:summary.humanEvidence",
        action: "approve",
        previousStatus: "review-required",
        reason: "   ",
        adminUserId: "admin-1",
      }),
    ).toThrow(/Begründung/);
    const draft = buildReviewActionDraft({
      entityType: "evidence_assessment",
      entityId: "e1",
      entityStableKey: "retatrutide:summary.humanEvidence",
      action: "approve",
      previousStatus: "review-required",
      reason: "Overlay A-F confirmed from sourced human evidence.",
      adminUserId: "admin-1",
    });
    expect(draft.newStatus).toBe("approved");
    expect(draft.action).toBe("approve");
  });

  it("keeps review history append-only", () => {
    const first = { id: "a" };
    const history = appendReviewHistory([first], { id: "b" });
    expect(history).toEqual([{ id: "a" }, { id: "b" }]);
    expect(first).toEqual({ id: "a" });
    expect(MIGRATION_0027).toContain("review_actions_insert_admin");
    expect(MIGRATION_0027).not.toMatch(/review_actions_update/);
    expect(MIGRATION_0027).not.toMatch(/review_actions_delete/);
    expect(SERVICE).toContain(".insert(");
    expect(SERVICE).not.toMatch(/from\("review_actions"\)\.update/);
    expect(SERVICE).not.toMatch(/from\("review_actions"\)\.delete/);
  });
});

describe("phase 8 review queue and traceability", () => {
  it("builds an open substance queue from the latest request_review action", () => {
    const open = openSubstanceReviews([
      {
        id: "1",
        entity_type: "substance",
        entity_stable_key: "mazdutide",
        action: "request_review",
        created_at: "2026-08-28T00:00:00Z",
        reason: "NMPA",
      },
      {
        id: "2",
        entity_type: "substance",
        entity_stable_key: "mazdutide",
        action: "approve",
        created_at: "2026-08-29T00:00:00Z",
        reason: "done",
      },
      {
        id: "3",
        entity_type: "substance",
        entity_stable_key: "orforglipron",
        action: "request_review",
        created_at: "2026-08-28T00:00:00Z",
        reason: "EMA",
      },
    ]);
    expect(open.map((row) => row.substanceSlug)).toEqual(["orforglipron"]);
  });

  it("requires claim sources and never treats community as science", () => {
    const seed = publishedClaimsSeed();
    expect(seed.claimsWithoutSources).toBe(0);
    expect(seed.claims.every((row) => claimIsTraceable(row.legacySourceIds))).toBe(true);
    expect(communityCannotAppearAsScientificEvidence("reddit")).toBe(true);
    expect(communityCannotAppearAsScientificEvidence("pubmed")).toBe(false);
    expect(SERVICE).toContain("communityCannotAppearAsScientificEvidence");
  });

  it("does not invent research_updates or community reports", () => {
    expect(RESEARCH_UPDATES_TABLE_EXISTS).toBe(false);
    expect(legacyAdminFallbackDashboard().researchUpdates).toBe(0);
    expect(legacyAdminFallbackDashboard().communityReports).toBe(0);
    expect(legacyAdminFallbackDashboard().source).toBe("legacy-fallback");
    expect(legacyAdminFallbackQueue().length).toBe(
      listPublishedProfiles().flatMap((profile) => profile.reviewItems ?? []).length,
    );
    expect(legacyAdminFallbackQueue()[0]?.note).toMatch(/^\[Legacy\]/);
  });

  it("keeps claim evidence separate from regulatory status", () => {
    expect(getPublishedProfile("retatrutide")?.regulatoryStatus).toBe("clinical-development");
    expect(getPublishedProfile("semaglutide")?.evidenceLevel).toBe("A");
    expect(getPublishedProfile("semaglutide")?.regulatoryStatus).toBe("approved-specific");
    expect(SERVICE).not.toMatch(/evidence_level.*approved/);
    expect(SERVICE).toContain('from("claims").update({ status: draft.newStatus })');
    expect(SERVICE).toContain("review_status: draft.newStatus");
  });
});

describe("phase 8 rls and public lexicon isolation", () => {
  it("keeps research writes admin-only in SQL", () => {
    expect(MIGRATION_0026).toContain("claims_update_admin");
    expect(MIGRATION_0026).toContain("has_role(auth.uid(), 'admin')");
    expect(MIGRATION_0027).toContain("review_actions_insert_admin");
    expect(MIGRATION_0027).toContain("regulatory_records_update_admin");
    expect(MIGRATION_0028).toContain("has_role(auth.uid(), 'admin')");
    expect(MIGRATION_0028).toContain("review_status = 'approved'");
    expect(SERVICE).toContain("assertAdminCanWriteReview");
  });

  it("does not select shop prices in research mapping", () => {
    expect(SERVICE).toContain("products(code, name)");
    expect(SERVICE).not.toMatch(/price_usd/);
    expect(ADMIN_PAGE).toMatch(/Keine Preise/);
    expect(ADMIN_PAGE).not.toMatch(/in den Warenkorb/i);
  });

  it("keeps catalog files as exclusive fallback while the public lexicon reads via usePublicLexicon", () => {
    expect(LEXICON).toContain("usePublicLexicon");
    expect(DETAIL).toContain("usePublicLexicon");
    expect(DETAIL).not.toContain("getPublishedProfile");
    expect(DETAIL).not.toContain("getSubstanceBySlug");
    expect(DETAIL).not.toContain("fetchAdminResearchDashboard");
    expect(ADMIN_PAGE).toContain("useAdminResearchDashboard");
    expect(ADMIN_PAGE).toContain("Postgres ist die Admin-Quelle");
    expect(researchDbMode({})).toBe("postgres");
    expect(lexiconDisplaySource({})).toBe("postgres");
    expect(lexiconDisplaySource({ VITE_RESEARCH_DB_MODE: "legacy" })).toBe("legacy");
  });
});

describe("phase 8 admin read, evidence, regulatory, studies, failure", () => {
  it("reads admin research from postgres with paginated queues", () => {
    expect(emptyDashboard("postgres").source).toBe("postgres");
    expect(ADMIN_RESEARCH_PAGE_SIZE).toBe(20);
    expect(SERVICE).toContain('emptyDashboard("postgres")');
    expect(SERVICE).toContain('{ count: "exact", head: true }');
    expect(SERVICE).toContain(".range(from, to)");
    expect(ADMIN_PAGE).toContain("Total Sources");
    expect(ADMIN_PAGE).toContain("Evidence Review");
    expect(ADMIN_PAGE).toContain("Regulatory Review");
  });

  it("keeps 267 review-required evidence assessments visible and not auto-approved", () => {
    const claims = publishedClaimsSeed();
    expect(claims.evidenceAssessments.filter((row) => row.reviewStatus === "review-required")).toHaveLength(267);
    expect(claims.evidenceAssessments.filter((row) => row.reviewStatus === "approved")).toHaveLength(27);
    expect(SERVICE).toContain('.eq("review_status", "review-required")');
    expect(SERVICE).not.toMatch(/evidence_assessments"\)[\s\S]*auto.?approv/i);
    expect(ADMIN_PAGE).not.toMatch(/automatisch freigeben/i);
  });

  it("surfaces regulatory review-required without treating approval as evidence A", () => {
    const regulatory = publishedRegulatorySeed();
    expect(regulatory.records.some((row) => row.reviewStatus === "review-required")).toBe(true);
    expect(regulatory.records.every((row) => row.legacySourceId.length > 0)).toBe(true);
    expect(SERVICE).toContain("regulatory_records");
    expect(SERVICE).toContain("application_id");
    expect(SERVICE).toContain("is_current");
    expect(ADMIN_PAGE).toContain("detail.authority");
  });

  it("traces studies by NCT and linked sources", () => {
    const science = publishedScienceSeed();
    expect(science.studies.every((row) => /^NCT\d+$/i.test(row.nctId) && row.title.length > 0)).toBe(true);
    const linked = new Set(science.studySources.map((row) => row.nctId));
    expect(science.studies.every((row) => linked.has(row.nctId))).toBe(true);
    expect(SERVICE).toContain("studies(nct_id, title, sponsor, phase, status)");
    expect(SERVICE).toContain("claim_sources");
  });

  it("fails loudly on postgres errors and only uses labeled legacy fallback", () => {
    expect(SERVICE).toContain("if (error) throw error");
    expect(ADMIN_PAGE).toContain("Postgres Research ist nicht erreichbar");
    expect(ADMIN_PAGE).toContain("Legacy-Fallback anzeigen (published.json)");
    expect(ADMIN_PAGE).toContain("nicht Source of Truth");
    expect(ADMIN_PAGE).toContain("setUseLegacy(true)");
    expect(legacyAdminFallbackDashboard().source).toBe("legacy-fallback");
    expect(legacyAdminFallbackDashboard().source).not.toBe("postgres");
    expect(legacyAdminFallbackQueue().every((row) => row.note?.startsWith("[Legacy]"))).toBe(true);
  });
});

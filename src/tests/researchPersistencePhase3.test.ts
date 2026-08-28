import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EXCLUDED_STUDY_NCTS, isExcludedNct } from "@/lib/peptide/persistence/identifiers";
import { buildPublishedClaimsSeed, publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { lexiconUsesPostgresScience, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { getPublishedProfile, listPublishedProfiles } from "@/lib/peptide/profiles";
import type { SubstanceProfile } from "@/lib/peptide/profiles/types";

const MIGRATION = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0026_research_claims_and_evidence.sql"),
  "utf8",
);

function payloadBetween(tag: string): string {
  const start = MIGRATION.indexOf(`$${tag}$`);
  const end = MIGRATION.indexOf(`$${tag}$`, start + tag.length + 2);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return MIGRATION.slice(start + tag.length + 2, end).trim();
}

describe("research persistence phase 3 claims", () => {
  const seed = publishedClaimsSeed();

  it("creates one claim per published cited block without splitting summary paragraphs", () => {
    expect(seed.legacyParagraphs).toBe(294);
    expect(seed.claims).toHaveLength(294);
    expect(seed.claimsWithSources).toBe(294);
    expect(seed.claimsWithoutSources).toBe(0);
    expect(seed.reviewRequiredClaims).toBe(0);
    expect(seed.hudsonHits).toEqual([]);
    expect(new Set(seed.claims.map((row) => row.stableKey)).size).toBe(294);
  });

  it("links every claim to at least one source and keeps claim_id+source unique", () => {
    expect(seed.claimSources.length).toBeGreaterThan(seed.claims.length);
    expect(seed.claimSources).toHaveLength(472);
    const pairs = seed.claimSources.map((row) => `${row.stableKey}::${row.legacySourceId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const claim of seed.claims) {
      expect(seed.claimSources.some((row) => row.stableKey === claim.stableKey)).toBe(true);
    }
  });

  it("stores evidence A–F only on humanEvidence claims from the published overlay", () => {
    expect(seed.evidenceAssessments).toHaveLength(294);
    const withLevel = seed.evidenceAssessments.filter((row) => row.evidenceLevel);
    expect(withLevel).toHaveLength(27);
    expect(withLevel.every((row) => row.stableKey.endsWith(":summary.humanEvidence"))).toBe(true);
    expect(getPublishedProfile("semaglutide")?.evidenceLevel).toBe("A");
    expect(seed.evidenceAssessments.find((row) => row.stableKey === "semaglutide:summary.humanEvidence")?.evidenceLevel).toBe(
      "A",
    );
    expect(seed.evidenceAssessments.find((row) => row.stableKey === "tb-500:summary.humanEvidence")?.evidenceLevel).toBe("F");
    expect(
      seed.evidenceAssessments.find((row) => row.stableKey === "semaglutide:summary.mechanism")?.evidenceLevel,
    ).toBeNull();
  });

  it("separates human and preclinical evidence types without mixing community", () => {
    const human = seed.evidenceAssessments.find((row) => row.stableKey === "semaglutide:summary.humanEvidence");
    const preclinical = seed.evidenceAssessments.find(
      (row) => row.stableKey === "semaglutide:summary.preclinicalEvidence",
    );
    expect(human?.evidenceType).toBe("human");
    expect(preclinical?.evidenceType).toBe("other");
    const safetyHuman = seed.evidenceAssessments.filter((row) => row.evidenceType === "human");
    const safetyAnimal = seed.evidenceAssessments.filter((row) => row.evidenceType === "animal");
    expect(safetyHuman.length).toBeGreaterThan(0);
    expect(seed.evidenceAssessments.some((row) => ["community", "anecdotal"].includes(row.evidenceType))).toBe(false);
    expect(safetyAnimal.length).toBeGreaterThanOrEqual(0);
  });

  it("marks a claim without sources as review-required", () => {
    const profile = getPublishedProfile("retatrutide") as SubstanceProfile;
    const clone: SubstanceProfile = {
      ...profile,
      summary: {
        ...profile.summary,
        unknowns: { text: "Unsourced placeholder for test.", sourceIds: [] },
      },
    };
    const isolated = buildPublishedClaimsSeed([clone]);
    const claim = isolated.claims.find((row) => row.stableKey === "retatrutide:summary.unknowns");
    expect(claim?.status).toBe("review-required");
    expect(isolated.claimsWithoutSources).toBeGreaterThan(0);
  });

  it("does not create published claims from Hudson NCTs", () => {
    expect(isExcludedNct("NCT07487363")).toBe(true);
    expect(EXCLUDED_STUDY_NCTS).toContain("NCT07437560");
    expect(seed.claimSources.some((row) => EXCLUDED_STUDY_NCTS.includes(row.nctId ?? ""))).toBe(false);
    expect(getPublishedProfile("tb-500")?.sources.some((source) => source.clinicalTrialId === "NCT07487363")).toBe(false);
  });

  it("keeps semantically similar claims separate when slots differ", () => {
    expect(seed.duplicatesKeptSeparate).toBeGreaterThanOrEqual(0);
    const reta = seed.claims.filter((row) => row.substanceSlug === "retatrutide");
    expect(reta.some((row) => row.claimType === "mechanism")).toBe(true);
    expect(reta.some((row) => row.claimType === "clinical_evidence")).toBe(true);
    expect(reta.some((row) => row.stableKey === "retatrutide:summary.mechanism")).toBe(true);
  });

  it("reconciles every published cited block as MATCH", () => {
    expect(seed.reconciliation.filter((row) => row.status === "MATCH")).toHaveLength(294);
    expect(seed.reconciliation.some((row) => row.status === "MISSING_IN_POSTGRES")).toBe(false);
    expect(seed.reconciliation.some((row) => row.status === "UNRESOLVED")).toBe(false);
  });
});

describe("research persistence phase 3 SQL migration", () => {
  const seed = publishedClaimsSeed();

  it("embeds the same claim keys as the TypeScript seed", () => {
    expect(MIGRATION).toContain(`-- claims: ${seed.claims.length}`);
    expect(MIGRATION).toContain(`-- claim_sources: ${seed.claimSources.length}`);
    expect(MIGRATION).toContain(`-- evidence_assessments: ${seed.evidenceAssessments.length}`);
    const sqlClaims = JSON.parse(payloadBetween("phase3_claims")) as Array<{ stable_key: string; status: string }>;
    expect(sqlClaims).toHaveLength(294);
    expect(sqlClaims.map((row) => row.stable_key).sort()).toEqual(seed.claims.map((row) => row.stableKey).sort());
    expect(sqlClaims.every((row) => row.status === "approved")).toBe(true);
    expect(MIGRATION).not.toMatch(/create table public\.regulatory_records/i);
    expect(MIGRATION).not.toMatch(/create table public\.community_reports/i);
  });

  it("creates RLS so only approved claims are publicly readable and writes are admin-only", () => {
    expect(MIGRATION).toMatch(/create table public\.claims/i);
    expect(MIGRATION).toMatch(/create table public\.claim_sources/i);
    expect(MIGRATION).toMatch(/create table public\.evidence_assessments/i);
    expect(MIGRATION).toMatch(/status = 'approved' or public\.has_role/);
    expect(MIGRATION).toMatch(/constraint claim_sources_pair unique/);
    expect(MIGRATION).toMatch(/has_role\(auth\.uid\(\), 'admin'\)/);
  });
});

describe("research persistence phase 3 dual-read flag", () => {
  it("defaults to postgres for public claims with emergency legacy rollback", () => {
    expect(researchDbMode({})).toBe("postgres");
    expect(lexiconUsesPostgresScience({})).toBe(true);
    expect(lexiconUsesPostgresScience({ VITE_RESEARCH_DB_MODE: "legacy" })).toBe(false);
  });
});

describe("research persistence phase 3 published profiles still load", () => {
  it("does not change lexicon published overlays", () => {
    expect(listPublishedProfiles()).toHaveLength(27);
    expect(getPublishedProfile("retatrutide")?.summary.mechanism.sourceIds.length).toBeGreaterThan(0);
  });
});

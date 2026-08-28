import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { identitySeedFromCatalog } from "@/lib/peptide/persistence/identitySeed";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { buildResearchReadinessReport } from "@/lib/peptide/persistence/researchReadiness";
import { lexiconUsesPostgresIdentity, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import { PRODUCT_CODE_PREFIX_RULES } from "@/lib/peptide/search";

const MIGRATIONS = [
  readFileSync(resolve(process.cwd(), "supabase/migrations/0024_research_identity_and_product_mapping.sql"), "utf8"),
  readFileSync(resolve(process.cwd(), "supabase/migrations/0025_research_sources_studies_runs.sql"), "utf8"),
  readFileSync(resolve(process.cwd(), "supabase/migrations/0026_research_claims_and_evidence.sql"), "utf8"),
  readFileSync(resolve(process.cwd(), "supabase/migrations/0027_research_regulatory_and_review.sql"), "utf8"),
];

describe("research persistence phase 5 readiness", () => {
  const report = buildResearchReadinessReport();

  it("inventories legacy catalog + published overlays against seed/Postgres design", () => {
    expect(PEPTIDE_SUBSTANCES_IDENTITY).toHaveLength(27);
    expect(listPublishedProfiles()).toHaveLength(27);
    expect(report.inventory.substances).toBe(27);
    expect(report.inventory.aliases).toBe(46);
    expect(report.inventory.components).toBe(3);
    expect(report.inventory.postgresSources).toBe(412);
    expect(report.inventory.jsonSources).toBe(468);
    expect(report.inventory.postgresStudies).toBe(118);
    expect(report.inventory.jsonStudies).toBe(123);
    expect(report.inventory.claims).toBe(294);
    expect(report.inventory.claimsWithSources).toBe(294);
    expect(report.inventory.claimsWithoutSources).toBe(0);
    expect(report.inventory.evidenceOverlayAF).toBe(27);
    expect(report.inventory.evidenceReviewRequired).toBe(267);
    expect(report.inventory.regulatoryRecords).toBe(41);
    expect(report.inventory.regulatoryHistory).toBe(0);
    expect(report.inventory.reviewActions).toBe(19);
    expect(report.inventory.reviewItems).toBe(19);
  });

  it("reports identity and alias parity against catalog.ts", () => {
    expect(report.identityParity).toEqual({
      MATCH: 27,
      MISSING_POSTGRES: 0,
      MISSING_LEGACY: 0,
      DIFFERENT: 0,
      UNRESOLVED: 0,
    });
    expect(report.aliasParity).toEqual({
      MATCH: 46,
      MISSING_POSTGRES: 0,
      MISSING_LEGACY: 0,
      DIFFERENT: 0,
      UNRESOLVED: 0,
    });
    expect(identitySeedFromCatalog().every((row) => row.casNumber === null && row.chemicalClass === null)).toBe(true);
  });

  it("reports source, study, and claim coverage without silent loss", () => {
    expect(report.sourceParity.MISSING_POSTGRES).toBe(0);
    expect(report.sourceParity.MISSING_LEGACY).toBe(0);
    expect(report.sourceParity.MATCH).toBe(468);
    expect(report.studyParity.MATCH).toBe(123);
    expect(report.studyParity.MISSING_POSTGRES).toBe(0);
    expect(report.claimParity.MATCH).toBe(294);
    expect(report.claimParity.MISSING_POSTGRES).toBe(0);
  });

  it("keeps evidence overlay A–F and review-required counts unchanged", () => {
    const claims = publishedClaimsSeed();
    expect(claims.evidenceAssessments).toHaveLength(294);
    expect(claims.evidenceAssessments.filter((row) => row.evidenceLevel)).toHaveLength(27);
    expect(claims.evidenceAssessments.filter((row) => row.reviewStatus === "review-required")).toHaveLength(267);
  });

  it("documents known regulatory UNRESOLVED rows without auto-correcting them", () => {
    const seed = publishedRegulatorySeed();
    const unresolved = seed.reconciliation
      .filter((row) => row.status === "UNRESOLVED" && !row.jsonRef.includes("overlay"))
      .map((row) => row.jsonRef)
      .sort();
    expect(unresolved).toEqual(["hcg:ema-ovitrelle", "semaglutide:fda-semaglutide-27f15fac"]);
    expect(report.regulatorySourceParity.UNRESOLVED).toBe(2);
    expect(report.regulatorySourceParity.MATCH).toBe(39);
    expect(seed.records.some((row) => row.status === "not_approved")).toBe(false);
  });

  it("excludes Hudson NCTs from published and seed entities (raw cache may retain them)", () => {
    expect(report.hudson.excluded).toEqual([...EXCLUDED_STUDY_NCTS]);
    expect(report.hudson.publishedStudyRows).toBe(0);
    expect(report.hudson.publishedSourceRows).toBe(0);
    expect(report.hudson.postgresStudyRows).toBe(0);
    expect(report.hudson.postgresSourceRows).toBe(0);
    expect(report.hudson.claimHits).toBe(0);
    const tb500 = readFileSync(resolve(process.cwd(), "src/research/cache/fetched/tb-500.json"), "utf8");
    const melanotan = readFileSync(resolve(process.cwd(), "src/research/cache/fetched/melanotan-ii.json"), "utf8");
    expect(tb500).toContain("NCT07487363");
    expect(melanotan).toContain("NCT07437560");
  });

  it("finds no community sources and no seed orphans", () => {
    expect(report.communitySources).toBe(0);
    expect(report.orphans).toEqual({
      sourceWithoutSubstance: 0,
      studyWithoutSubstance: 0,
      studyWithoutSource: 0,
      claimsWithoutSources: 0,
      evidenceWithoutClaim: 0,
      regulatoryWithoutSource: 0,
    });
  });

  it("keeps product mapping prefix rules aligned and records that fuzzy name matching is SQL-only-absent", () => {
    expect(PRODUCT_CODE_PREFIX_RULES.some((rule) => rule.test.test("RT5") && rule.slug === "retatrutide")).toBe(true);
    expect(PRODUCT_CODE_PREFIX_RULES.some((rule) => rule.test.test("RT40") && rule.slug === "retatrutide")).toBe(true);
    expect(report.mappingNotes.clientFuzzyNameNotInSql).toBe(true);
    expect(MIGRATIONS[0]).toContain("^RT[0-9]");
    expect(MIGRATIONS[0]).toContain("glow-blend");
    expect(MIGRATIONS[0]).not.toContain("fuzzy");
  });

  it("confirms research RLS is admin-write and review_actions are insert-only", () => {
    const all = MIGRATIONS.join("\n");
    expect(all).toMatch(/create policy "claims_write_admin"/);
    expect(all).toContain("has_role(auth.uid(), 'admin')");
    expect(all).not.toMatch(/create policy "[^"]+" on public\.\w+ for insert to anon/);
    expect(MIGRATIONS[3]).toContain("review_actions_insert_admin");
    expect(MIGRATIONS[3]).not.toMatch(/review_actions_update/);
    expect(MIGRATIONS[3]).not.toMatch(/review_actions_delete/);
  });

  it("does not treat the Phase 5 audit as a live lexicon switch", () => {
    expect(report.contentReadiness).toBe("READY_WITH_REVIEW");
    expect(report.lexiconSwitchReadiness).toBe("NOT_READY");
    expect(report.deployedMigrationsAppliedThrough).toBe("0023");
  });

  it("uses postgres as the live public lexicon default after Phase 11", () => {
    expect(researchDbMode({})).toBe("postgres");
    expect(lexiconUsesPostgresIdentity({})).toBe(true);
    expect(lexiconUsesPostgresIdentity({ VITE_RESEARCH_DB_MODE: "legacy" })).toBe(false);
  });
});

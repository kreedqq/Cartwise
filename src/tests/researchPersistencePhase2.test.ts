import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EXCLUDED_STUDY_NCTS,
  isExcludedNct,
  isFictionalOrExampleStudyTitle,
  normalizeDoi,
  normalizeNct,
  normalizePmid,
} from "@/lib/peptide/persistence/identifiers";
import {
  BATCH_02_SLUGS,
  mapPublishedSourceType,
  publishedScienceSeed,
} from "@/lib/peptide/persistence/publishedScienceSeed";
import { lexiconUsesPostgresScience, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { getPublishedProfile, listPublishedProfiles } from "@/lib/peptide/profiles";
import { COMMUNITY_SOURCE_TYPES } from "@/lib/peptide/types";

const MIGRATION = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0025_research_sources_studies_runs.sql"),
  "utf8",
);

function payloadBetween(tag: string): string {
  const start = MIGRATION.indexOf(`$${tag}$`);
  const end = MIGRATION.indexOf(`$${tag}$`, start + tag.length + 2);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return MIGRATION.slice(start + tag.length + 2, end).trim();
}

describe("identifier normalization", () => {
  it("normalizes DOI prefixes and case without inventing identifiers", () => {
    expect(normalizeDoi("https://doi.org/10.1056/NEJMoa2301972")).toBe("10.1056/nejmoa2301972");
    expect(normalizeDoi("doi:10.1056/NEJMoa2301972")).toBe("10.1056/nejmoa2301972");
    expect(normalizeDoi("10.1056/NEJMoa2301972")).toBe("10.1056/nejmoa2301972");
    expect(normalizeDoi("")).toBeNull();
  });

  it("stores PMID as digits only", () => {
    expect(normalizePmid("PMID 37366315")).toBe("37366315");
    expect(normalizePmid("37366315")).toBe("37366315");
    expect(normalizePmid("pmid: 37366315")).toBe("37366315");
  });

  it("uppercases NCT without changing the digits", () => {
    expect(normalizeNct("nct06354660")).toBe("NCT06354660");
    expect(normalizeNct("NCT06354660")).toBe("NCT06354660");
    expect(normalizeNct("NCT-06354660")).toBeNull();
  });
});

describe("research persistence phase 2 published import", () => {
  const seed = publishedScienceSeed();

  it("imports every published source and study row after identifier dedup", () => {
    expect(seed.jsonSourceRows).toBe(468);
    expect(seed.jsonStudyRows).toBe(123);
    expect(seed.sourceSubstances).toHaveLength(468);
    expect(seed.studySubstances).toHaveLength(123);
    expect(seed.sources).toHaveLength(412);
    expect(seed.studies).toHaveLength(118);
    expect(seed.rejectedSources).toEqual([]);
    expect(seed.rejectedStudies).toEqual([]);
    expect(seed.hudsonExclusions).toEqual([...EXCLUDED_STUDY_NCTS]);
  });

  it("deduplicates by PMID/DOI/NCT and keeps multi-substance mappings", () => {
    const shared = seed.sources.find((row) => row.pmid === "40988099");
    expect(shared?.substanceSlugs.sort()).toEqual(["liraglutide", "retatrutide", "semaglutide"]);
    expect(new Set(seed.sources.map((row) => row.pmid).filter(Boolean)).size).toBe(
      seed.sources.filter((row) => row.pmid).length,
    );
    expect(new Set(seed.studies.map((row) => row.nctId)).size).toBe(seed.studies.length);
  });

  it("excludes Hudson fictional NCTs and does not treat Demonstrating titles as fake", () => {
    expect(isExcludedNct("NCT07487363")).toBe(true);
    expect(isExcludedNct("nct07437560")).toBe(true);
    expect(seed.studies.some((row) => EXCLUDED_STUDY_NCTS.includes(row.nctId))).toBe(false);
    expect(seed.sources.some((row) => EXCLUDED_STUDY_NCTS.includes(row.nctId ?? ""))).toBe(false);
    expect(isFictionalOrExampleStudyTitle("Purpose to Evaluate ... Demonstrating Its Equivalence")).toBe(false);
    expect(getPublishedProfile("tb-500")?.studies.some((study) => study.clinicalTrialId === "NCT07487363")).toBe(false);
    expect(getPublishedProfile("melanotan-ii")?.studies.some((study) => study.clinicalTrialId === "NCT07437560")).toBe(
      false,
    );
  });

  it("keeps identity separations in source/study mapping", () => {
    const tb500 = seed.studySubstances.filter((row) => row.substanceSlug === "tb-500");
    const tb4 = seed.studySubstances.filter((row) => row.substanceSlug === "thymosin-beta-4");
    expect(tb500).toEqual([]);
    expect(tb4.length).toBeGreaterThan(0);
    expect(seed.sources.some((row) => /afamelanotide|scenesse/i.test(row.title) && row.substanceSlugs.includes("melanotan-ii"))).toBe(
      false,
    );
    expect(seed.sources.some((row) => /mecasermin|increlex/i.test(row.title) && row.substanceSlugs.includes("igf-1-lr3"))).toBe(
      false,
    );
    const glow = seed.sourceSubstances.filter((row) => row.substanceSlug === "glow-blend");
    expect(glow.length).toBe(getPublishedProfile("glow-blend")?.sources.length);
    expect(glow.every((row) => row.substanceSlug === "glow-blend")).toBe(true);
  });

  it("maps Batch 02 accepted counts and historical import runs without invented timestamps", () => {
    const batch02 = seed.researchRuns.find((row) => row.batchLabel === "batch-02");
    expect(batch02?.runType).toBe("historical_import");
    expect(batch02?.sourceKeys).toHaveLength(125);
    expect(batch02?.studyNcts).toHaveLength(25);
    expect(BATCH_02_SLUGS).toHaveLength(12);
    expect(seed.researchRuns.every((row) => row.connector === "published.json")).toBe(true);
  });

  it("links each unique NCT study to its clinical_trial source", () => {
    expect(seed.studySources).toHaveLength(seed.studies.length);
    for (const study of seed.studies) {
      expect(seed.studySources.some((link) => link.nctId === study.nctId)).toBe(true);
    }
  });

  it("does not import community source types as scientific sources", () => {
    for (const profile of listPublishedProfiles()) {
      expect(profile.sources.some((source) => COMMUNITY_SOURCE_TYPES.includes(source.sourceType))).toBe(false);
    }
    expect(seed.sources.some((row) => ["blog", "reddit", "forum", "community"].includes(row.sourceType))).toBe(false);
  });

  it("infers FDA/EMA from regulatory URLs without creating regulatory_records", () => {
    const mounjaro = getPublishedProfile("tirzepatide")?.sources.find((source) => source.id === "fda-mounjaro");
    const epar = getPublishedProfile("tirzepatide")?.sources.find((source) => source.id === "ema-mounjaro");
    expect(mounjaro && mapPublishedSourceType(mounjaro)).toBe("fda");
    expect(epar && mapPublishedSourceType(epar)).toBe("ema");
    expect(MIGRATION).not.toMatch(/create table public\.regulatory_records/i);
    expect(MIGRATION).not.toMatch(/create table public\.claims/i);
    expect(MIGRATION).not.toMatch(/create table public\.community_reports/i);
  });

  it("reconciles published.json attachments as MATCH with no silent loss", () => {
    const sourceMatches = seed.reconciliation.filter((row) => row.kind === "source" && row.status === "MATCH");
    const studyMatches = seed.reconciliation.filter((row) => row.kind === "study" && row.status === "MATCH");
    expect(sourceMatches).toHaveLength(468);
    expect(studyMatches).toHaveLength(123);
    expect(seed.reconciliation.some((row) => row.status === "MISSING_IN_POSTGRES")).toBe(false);
    expect(seed.reconciliation.some((row) => row.status === "MISSING_IN_JSON")).toBe(false);
    expect(seed.reconciliation.some((row) => row.status === "UNRESOLVED")).toBe(false);
  });
});

describe("research persistence phase 2 SQL migration", () => {
  const seed = publishedScienceSeed();

  it("embeds the same unique source and study counts as the TypeScript seed", () => {
    expect(MIGRATION).toContain(`-- unique_sources: ${seed.sources.length}`);
    expect(MIGRATION).toContain(`-- unique_studies: ${seed.studies.length}`);
    expect(MIGRATION).toContain(`-- source_substance_links: ${seed.sourceSubstances.length}`);
    expect(MIGRATION).toContain(`-- study_substance_links: ${seed.studySubstances.length}`);
    const sqlSources = JSON.parse(payloadBetween("phase2_sources")) as Array<{ key: string; pmid: string | null }>;
    const sqlStudies = JSON.parse(payloadBetween("phase2_studies")) as Array<{ nct_id: string }>;
    expect(sqlSources).toHaveLength(seed.sources.length);
    expect(sqlStudies).toHaveLength(seed.studies.length);
    expect(sqlStudies.some((row) => EXCLUDED_STUDY_NCTS.includes(row.nct_id))).toBe(false);
    expect(sqlSources.map((row) => row.key).sort()).toEqual(seed.sources.map((row) => row.key).sort());
  });

  it("creates RLS admin-write policies and historical_import runs", () => {
    expect(MIGRATION).toMatch(/create table public\.research_runs/i);
    expect(MIGRATION).toMatch(/create table public\.research_run_sources/i);
    expect(MIGRATION).toMatch(/create table public\.sources/i);
    expect(MIGRATION).toMatch(/create table public\.studies/i);
    expect(MIGRATION).toMatch(/create table public\.source_substances/i);
    expect(MIGRATION).toMatch(/create table public\.study_substances/i);
    expect(MIGRATION).toMatch(/create table public\.study_sources/i);
    expect(MIGRATION).toMatch(/has_role\(auth\.uid\(\), 'admin'\)/);
    expect(MIGRATION).toMatch(/status = 'active' or public\.has_role/);
    expect(MIGRATION).toMatch(/historical_import/);
    expect(MIGRATION).toMatch(/on delete restrict/i);
  });
});

describe("research persistence phase 2 dual-read flag", () => {
  it("defaults to legacy so the lexicon does not switch to Postgres sources", () => {
    expect(researchDbMode({})).toBe("legacy");
    expect(lexiconUsesPostgresScience({})).toBe(false);
    expect(lexiconUsesPostgresScience({ VITE_RESEARCH_DB_MODE: "postgres" })).toBe(true);
  });
});

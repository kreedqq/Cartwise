import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { LEXICON_STATUS_FILTERS, matchesLexiconStatus } from "@/lib/peptide/lexiconFilters";
import {
  failingPublicSelectClient,
  isPublicClaim,
  isPublicEvidence,
  isPublicRegulatory,
  mapPublicLexicon,
  mockPublicSelectClient,
  publicBundleFromSeeds,
  publicClaims,
  publicEvidence,
  publicRegulatory,
  publicResponseHasAdminLeak,
  publicStudies,
  resolvePublicLexicon,
  validatePublicLexiconBundle,
} from "@/lib/peptide/lexicon";
import { tablesFromPublicBundle } from "@/lib/peptide/lexicon/seedBundle";
import { EXCLUDED_STUDY_NCTS } from "@/lib/peptide/persistence/identifiers";
import { lexiconDisplaySource, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { searchLexiconSubstances, searchSubstances } from "@/lib/peptide/search";
import { CATEGORY_LABELS } from "@/lib/peptide/catalog";

const FETCH_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/lexicon/fetchPublicLexicon.ts"), "utf8");
const MAP_SRC = readFileSync(resolve(process.cwd(), "src/lib/peptide/lexicon/mapPublicLexicon.ts"), "utf8");
const HOOK_SRC = readFileSync(resolve(process.cwd(), "src/hooks/usePublicLexicon.ts"), "utf8");
const LEXICON_PAGE = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexicon.tsx"), "utf8");
const DETAIL_PAGE = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexiconDetail.tsx"), "utf8");
const CALC_PAGE = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideCalculator.tsx"), "utf8");
const MIGRATION_0026 = readFileSync(resolve(process.cwd(), "supabase/migrations/0026_research_claims_and_evidence.sql"), "utf8");
const MIGRATION_0027 = readFileSync(resolve(process.cwd(), "supabase/migrations/0027_research_regulatory_and_review.sql"), "utf8");
const MIGRATION_0028 = readFileSync(resolve(process.cwd(), "supabase/migrations/0028_research_evidence_assessments_select_approved.sql"), "utf8");

function seedClient() {
  return mockPublicSelectClient(tablesFromPublicBundle(publicBundleFromSeeds()));
}

describe("phase 11 public lexicon mode", () => {
  it("defaults to postgres and rolls back with VITE_RESEARCH_DB_MODE=legacy", () => {
    expect(researchDbMode({})).toBe("postgres");
    expect(lexiconDisplaySource({})).toBe("postgres");
    expect(researchDbMode({ VITE_RESEARCH_DB_MODE: "legacy" })).toBe("legacy");
    expect(lexiconDisplaySource({ VITE_RESEARCH_DB_MODE: "legacy" })).toBe("legacy");
    expect(existsSync(resolve(process.cwd(), "src/lib/peptide/catalog.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/lib/peptide/profiles/published.json"))).toBe(true);
  });
});

describe("phase 11 postgres read + exclusive fallback", () => {
  it("reads the seed-shaped public bundle without review_actions", async () => {
    const catalog = await resolvePublicLexicon({ client: seedClient(), mode: "postgres", timeoutMs: 2000 });
    expect(catalog.source).toBe("postgres");
    expect(catalog.fallback).toBeNull();
    expect(catalog.substances).toHaveLength(27);
    expect(catalog.profiles.size).toBe(27);
    expect(publicResponseHasAdminLeak(catalog.substances)).toBe(false);
    expect(publicResponseHasAdminLeak([...catalog.profiles.values()])).toBe(false);
    expect(FETCH_SRC).not.toMatch(/["']review_actions["']/);
    expect(FETCH_SRC).not.toMatch(/price_usd|selling_price/);
  });

  it("falls back to the full legacy catalog on timeout, rls, network, and query errors", async () => {
    for (const kind of ["timeout", "rls", "network", "query"] as const) {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const catalog = await resolvePublicLexicon({
        client: failingPublicSelectClient(kind),
        mode: "postgres",
        timeoutMs: 40,
      });
      expect(catalog.source).toBe("legacy");
      expect(catalog.fallback?.kind).toBe(kind);
      expect(catalog.substances).toHaveLength(27);
      expect(catalog.profiles.get("retatrutide")?.summary.mechanism.text.length).toBeGreaterThan(0);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    }
  });

  it("does not mix postgres identity with legacy science on incomplete bundles", async () => {
    const bundle = publicBundleFromSeeds();
    bundle.substances = bundle.substances.filter((row) => row.slug !== "selank");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const catalog = await resolvePublicLexicon({
      client: mockPublicSelectClient(tablesFromPublicBundle(bundle)),
      mode: "postgres",
      timeoutMs: 2000,
    });
    expect(catalog.source).toBe("legacy");
    expect(catalog.fallback?.kind).toBe("incomplete");
    expect(catalog.substances.map((row) => row.slug)).toContain("selank");
    expect(catalog.profiles.get("selank")?.summary.whatIsIt.text).toBeTruthy();
    warn.mockRestore();
  });

  it("uses the exclusive legacy catalog when mode is legacy even if postgres would succeed", async () => {
    const catalog = await resolvePublicLexicon({ client: seedClient(), mode: "legacy", timeoutMs: 2000 });
    expect(catalog.source).toBe("legacy");
    expect(catalog.fallback).toBeNull();
  });
});

describe("phase 11 public visibility", () => {
  it("hides review-required claims, evidence, and regulatory records", () => {
    expect(isPublicClaim({ status: "review-required", sourceCount: 3 })).toBe(false);
    expect(isPublicClaim({ status: "approved", sourceCount: 0 })).toBe(false);
    expect(isPublicClaim({ status: "approved", sourceCount: 1 })).toBe(true);
    expect(isPublicClaim({ status: "draft", sourceCount: 2 })).toBe(false);
    expect(isPublicEvidence({ review_status: "review-required" })).toBe(false);
    expect(isPublicEvidence({ review_status: "approved" })).toBe(true);
    expect(isPublicRegulatory({ review_status: "review-required", is_current: true })).toBe(false);
    expect(isPublicRegulatory({ review_status: "approved", is_current: false })).toBe(false);
    expect(isPublicRegulatory({ review_status: "approved", is_current: true })).toBe(true);

    const bundle = publicBundleFromSeeds();
    const claims = publishedClaimsSeed();
    expect(claims.evidenceAssessments.filter((row) => row.reviewStatus === "review-required")).toHaveLength(267);
    expect(publicEvidence(bundle)).toHaveLength(27);
    expect(publicClaims(bundle).every((row) => row.status === "approved")).toBe(true);
    expect(publicRegulatory(bundle).every((row) => row.review_status === "approved" && row.is_current)).toBe(true);

    const leaked = structuredClone(bundle);
    leaked.claims.push({
      id: "leak-claim",
      stable_key: "retatrutide:leaked",
      substance_id: "retatrutide",
      claim_type: "other",
      statement: "THIS MUST NOT BE PUBLIC",
      status: "review-required",
      safety_category: null,
    });
    leaked.claimSources.push({
      claim_id: "leak-claim",
      source_id: leaked.sources[0]?.id ?? "x",
      study_id: null,
    });
    leaked.evidence.push({
      claim_id: leaked.claims.find((row) => row.stable_key === "retatrutide:summary.humanEvidence")?.id ?? "x",
      evidence_level: "A",
      confidence: "high",
      evidence_type: "human",
      review_status: "review-required",
    });
    leaked.regulatory.push({
      ...leaked.regulatory[0],
      stable_key: "retatrutide:leaked-reg",
      review_status: "review-required",
      product_name: "LEAKED PRODUCT",
    });

    const mapped = mapPublicLexicon(leaked);
    const profile = mapped.profiles.get("retatrutide");
    const blob = JSON.stringify(profile);
    expect(blob).not.toContain("THIS MUST NOT BE PUBLIC");
    expect(blob).not.toContain("LEAKED PRODUCT");
    expect(profile?.reviewItems).toEqual([]);
    expect(publicResponseHasAdminLeak(profile)).toBe(false);
  });

  it("does not auto-promote identity-only substances to Evidence A or Approved", () => {
    const bundle = publicBundleFromSeeds();
    bundle.evidence = [];
    bundle.regulatory = bundle.regulatory.filter((row) => row.substance_id !== "tb-500");
    const mapped = mapPublicLexicon(bundle);
    const tb = mapped.substances.find((row) => row.slug === "tb-500");
    expect(tb?.evidenceLevel).toBe("F");
    expect(tb?.regulatoryStatus).toBe("insufficient");
    expect(tb?.name).toBe("TB-500");
  });
});

describe("phase 11 hudson / identity / search / filters", () => {
  it("excludes Hudson NCTs from public studies", () => {
    const bundle = publicBundleFromSeeds();
    bundle.studies.push(
      {
        id: "hudson-a",
        nct_id: "NCT07487363",
        title: "Hudson A",
        sponsor: "x",
        phase: null,
        status: null,
        enrollment: null,
        start_date: null,
        completion_date: null,
        last_updated: null,
        has_results: false,
        source_url: "https://example.invalid",
      },
      {
        id: "hudson-b",
        nct_id: "NCT07437560",
        title: "Hudson B",
        sponsor: "x",
        phase: null,
        status: null,
        enrollment: null,
        start_date: null,
        completion_date: null,
        last_updated: null,
        has_results: false,
        source_url: "https://example.invalid",
      },
    );
    bundle.studySubstances.push(
      { study_id: "hudson-a", substance_id: "retatrutide" },
      { study_id: "hudson-b", substance_id: "retatrutide" },
    );
    expect(EXCLUDED_STUDY_NCTS).toEqual(["NCT07487363", "NCT07437560"]);
    expect(publicStudies(bundle).some((row) => EXCLUDED_STUDY_NCTS.includes(row.nct_id))).toBe(false);
    const mapped = mapPublicLexicon(bundle);
    const ncts = mapped.profiles.get("retatrutide")?.studies.map((row) => row.clinicalTrialId) ?? [];
    expect(ncts).not.toContain("NCT07487363");
    expect(ncts).not.toContain("NCT07437560");
  });

  it("keeps TB-500 distinct from Thymosin Beta-4 and Glow as a blend", () => {
    const mapped = mapPublicLexicon(publicBundleFromSeeds());
    const tb = mapped.substances.find((row) => row.slug === "tb-500");
    const tb4 = mapped.substances.find((row) => row.slug === "thymosin-beta-4");
    const glow = mapped.substances.find((row) => row.slug === "glow-blend");
    const mt = mapped.substances.find((row) => row.slug === "melanotan-ii");
    const igf = mapped.substances.find((row) => row.slug === "igf-1-lr3");
    expect(tb?.identityNote).toMatch(/nicht automatisch/i);
    expect(tb4?.identityNote).toMatch(/TB-500/i);
    expect(glow?.blendComponentSlugs).toEqual(["ghk-cu", "tb-500", "bpc-157"]);
    expect(glow?.moleculeType).toBe("blend");
    expect(mt?.identityNote).toMatch(/Afamelanotid|Scenesse/i);
    expect(igf?.identityNote).toMatch(/Mecasermin/i);
  });

  it("searches name, alias, development name, CAS, and slug without false identity matches", () => {
    const mapped = mapPublicLexicon(publicBundleFromSeeds());
    const search = (q: string) => searchLexiconSubstances(mapped.substances, q).map((row) => row.slug);
    expect(search("Reta")).toEqual(["retatrutide"]);
    expect(search("Retatrutide")).toContain("retatrutide");
    expect(search("LY3437943")).toEqual(["retatrutide"]);
    expect(search("Tirze")).toEqual(["tirzepatide"]);
    expect(search("Tirzepatide")).toContain("tirzepatide");
    expect(search("Semax")).toEqual(["semax"]);
    expect(search("Selank")).toEqual(["selank"]);
    expect(search("MOTS-c")).toContain("mots-c");
    const tb = search("TB-500");
    expect(tb).toContain("tb-500");
    expect(tb).not.toContain("thymosin-beta-4");
    expect(search("Thymosin Beta-4")).toEqual(["thymosin-beta-4"]);
    expect(searchSubstances("Reta").some((row) => row.slug === "retatrutide")).toBe(true);
  });

  it("keeps category and status filters on the postgres-mapped list", () => {
    const mapped = mapPublicLexicon(publicBundleFromSeeds());
    expect(new Set(mapped.substances.map((row) => row.category)).size).toBeGreaterThan(1);
    for (const identity of PEPTIDE_SUBSTANCES_IDENTITY) {
      expect(mapped.substances.find((row) => row.slug === identity.slug)?.category).toBe(identity.category);
      expect(CATEGORY_LABELS[identity.category]).toBeTruthy();
    }
    const clinical = mapped.substances.filter((row) => matchesLexiconStatus(row, "clinical-trial"));
    expect(clinical.some((row) => row.slug === "retatrutide")).toBe(true);
    expect(LEXICON_STATUS_FILTERS.map((row) => row.id)).toEqual([
      "all",
      "approved",
      "clinical-trial",
      "investigational",
      "preclinical",
      "limited-data",
    ]);
  });
});

describe("phase 11 detail / regulatory / reconstitution / calculator", () => {
  it("maps overview, mechanism, effects, safety, interactions, reconstitution, studies, sources, evidence, regulatory", () => {
    const mapped = mapPublicLexicon(publicBundleFromSeeds());
    const reta = mapped.profiles.get("retatrutide");
    expect(reta?.summary.whatIsIt.text.length).toBeGreaterThan(0);
    expect(reta?.summary.whatIsIt.sourceIds.length).toBeGreaterThan(0);
    expect(reta?.summary.mechanism.text.length).toBeGreaterThan(0);
    expect(reta?.summary.humanEvidence.text.length).toBeGreaterThan(0);
    expect(reta?.summary.safety.text.length).toBeGreaterThan(0);
    expect(reta?.studies.length).toBeGreaterThan(0);
    expect(reta?.sources.length).toBeGreaterThan(0);
    expect(mapped.substances.find((row) => row.slug === "retatrutide")?.evidenceLevel).not.toBe("A");
    expect(mapped.substances.find((row) => row.slug === "retatrutide")?.regulatoryStatus).toBe("clinical-development");
  });

  it("keeps Orforglipron FOUNDAYO as US NDA220934 without a global Approved stamp", () => {
    const mapped = mapPublicLexicon(publicBundleFromSeeds());
    const orf = mapped.substances.find((row) => row.slug === "orforglipron");
    const profile = mapped.profiles.get("orforglipron");
    const seed = publishedRegulatorySeed().records.find((row) => row.legacySourceId === "fda-foundayo");
    expect(seed?.productName).toMatch(/FOUNDAYO/i);
    expect(seed?.applicationId).toBe("NDA220934");
    expect(seed?.region).toBe("US");
    expect(orf?.regulatoryStatus).toBe("approved-specific");
    expect(profile?.regulatoryRegions).toEqual(expect.arrayContaining(["US"]));
    expect(profile?.regulatoryRegions).not.toContain("EU");
  });

  it("only emits reconstitution from sourced approved claims and keeps the calculator math-only", () => {
    const mapped = mapPublicLexicon(publicBundleFromSeeds());
    const reta = mapped.profiles.get("retatrutide");
    if (reta?.reconstitution) {
      expect(reta.reconstitution.sourceIds.length).toBeGreaterThan(0);
    }
    expect(CALC_PAGE).toContain("calculateReconstitution");
    expect(CALC_PAGE).not.toContain("resolvePublicLexicon");
    expect(CALC_PAGE).not.toContain("usePublicLexicon");
    expect(CALC_PAGE).toMatch(/Keine Dosierungsempfehlung/);
  });
});

describe("phase 11 rls / security / shop / auth / performance", () => {
  it("documents live RLS: evidence and regulatory are restricted; claims still need a client filter", () => {
    expect(MIGRATION_0028).toMatch(/Other authenticated users only see approved assessments/);
    expect(MIGRATION_0027).toMatch(/review_status = 'approved'/);
    expect(MIGRATION_0027).toMatch(/review_actions_select_admin/);
    expect(MIGRATION_0026).toMatch(/claims_select_authenticated/);
    expect(MIGRATION_0026).toMatch(/status = 'approved' or public.has_role/);
    expect(FETCH_SRC).toContain('eq: { status: "approved" }');
    expect(FETCH_SRC).toContain('eq: { review_status: "approved" }');
  });

  it("does not change shop, auth, or load review_actions on the public path", () => {
    expect(LEXICON_PAGE).toMatch(/keine Shoppreise/);
    expect(LEXICON_PAGE).not.toMatch(/in den Warenkorb/i);
    expect(DETAIL_PAGE).toMatch(/Keine Preise/);
    expect(DETAIL_PAGE).not.toContain("review_actions");
    expect(MAP_SRC).not.toContain("review_actions");
    expect(HOOK_SRC).toContain("staleTime: PUBLIC_LEXICON_CACHE_MS");
    expect(HOOK_SRC).toContain("retry: 0");
    expect(validatePublicLexiconBundle(publicBundleFromSeeds()).ok).toBe(true);
  });
});

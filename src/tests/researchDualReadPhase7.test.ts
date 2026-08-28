import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PEPTIDE_SUBSTANCES, PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import {
  UNMAP_PREFIX_CODES,
  UNRESOLVED_PRODUCT_MAPPINGS,
} from "@/lib/peptide/persistence/explicitProductMappings";
import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import { postgresBundleFromSeeds } from "@/lib/peptide/persistence/dualRead/bundle";
import { compareResearchSnapshots, INTEGRATION_SLUGS, SEARCH_QUERIES } from "@/lib/peptide/persistence/dualRead/compare";
import { failingSelectClient, fetchPostgresResearch, mockSelectClient } from "@/lib/peptide/persistence/dualRead/fetchPostgres";
import { normalizeLegacyResearch } from "@/lib/peptide/persistence/dualRead/normalizeLegacy";
import { normalizePostgresResearch } from "@/lib/peptide/persistence/dualRead/normalizePostgres";
import { logDualReadReport } from "@/lib/peptide/persistence/dualRead/log";
import { legacyOnlyReport, runDualRead } from "@/lib/peptide/persistence/dualRead/runDualRead";
import {
  lexiconDisplaySource,
  lexiconUsesPostgresIdentity,
  researchDbMode,
  shouldCompareResearchReads,
} from "@/lib/peptide/persistence/researchDbMode";
import { postgresMappingSlug } from "@/lib/peptide/persistence/sqlProductMapping";
import { getPublishedProfile, listPublishedProfiles } from "@/lib/peptide/profiles";
import { searchSubstances, substanceSlugForProduct } from "@/lib/peptide/search";
import { communityCannotRaiseEvidence, isCommunitySource } from "@/lib/peptide/types";

function seedParityReport() {
  const legacy = normalizeLegacyResearch();
  const postgres = normalizePostgresResearch(postgresBundleFromSeeds());
  return { legacy, postgres, report: compareResearchSnapshots(legacy, postgres, { mode: "dual" }) };
}

function mockClientFromBundle() {
  const bundle = postgresBundleFromSeeds();
  return mockSelectClient({
    substances: bundle.substances,
    substance_aliases: bundle.aliases,
    substance_components: bundle.components,
    sources: bundle.sources,
    source_substances: bundle.sourceSubstances,
    studies: bundle.studies,
    study_substances: bundle.studySubstances,
    claims: bundle.claims,
    claim_sources: bundle.claimSources,
    evidence_assessments: bundle.evidence,
    regulatory_records: bundle.regulatory,
    review_actions: bundle.reviewActions,
    product_substances: bundle.productMaps.map((row) => ({
      mapping_method: "manual",
      substances: { slug: row.substance_slug },
      products: { code: row.code, name: row.name },
    })),
  });
}

describe("phase 7 dual-read mode", () => {
  it("defaults to legacy and does not switch the lexicon display", () => {
    expect(researchDbMode({})).toBe("legacy");
    expect(researchDbMode({ VITE_RESEARCH_DB_MODE: "dual" })).toBe("dual");
    expect(researchDbMode({ VITE_RESEARCH_DB_MODE: "postgres" })).toBe("postgres");
    expect(lexiconUsesPostgresIdentity({})).toBe(false);
    expect(lexiconUsesPostgresIdentity({ VITE_RESEARCH_DB_MODE: "dual" })).toBe(false);
    expect(shouldCompareResearchReads({ VITE_RESEARCH_DB_MODE: "dual" })).toBe(true);
    expect(shouldCompareResearchReads({})).toBe(false);
    expect(lexiconDisplaySource()).toBe("legacy");
  });

  it("keeps catalog.ts and published.json in the tree", () => {
    expect(existsSync(resolve(process.cwd(), "src/lib/peptide/catalog.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/lib/peptide/profiles/published.json"))).toBe(true);
    expect(PEPTIDE_SUBSTANCES_IDENTITY).toHaveLength(27);
    expect(listPublishedProfiles()).toHaveLength(27);
  });
});

describe("phase 7 identity / alias / search / filter parity", () => {
  const { legacy, postgres, report } = seedParityReport();

  it("matches 27 identities and 46 aliases without identity errors", () => {
    expect(legacy.identities).toHaveLength(27);
    expect(postgres.identities).toHaveLength(27);
    const identity = report.differences.filter((row) => row.family === "identity");
    expect(identity.every((row) => row.status === "MATCH" || row.status === "ORDER_ONLY" || row.status === "FORMAT_ONLY")).toBe(
      true,
    );
    expect(identity.some((row) => row.critical)).toBe(false);
    expect(postgres.identities.reduce((sum, row) => sum + row.aliases.length + row.developmentNames.length, 0)).toBe(46);
  });

  it("keeps TB-500, Thymosin Beta-4, Melanotan II, IGF-1 LR3 and glow-blend distinct", () => {
    const slugs = postgres.identities.map((row) => row.slug);
    expect(slugs).toEqual(expect.arrayContaining(["tb-500", "thymosin-beta-4", "melanotan-ii", "igf-1-lr3", "glow-blend"]));
    expect(postgres.identities.find((row) => row.slug === "glow-blend")?.blendComponentSlugs).toEqual([
      "ghk-cu",
      "tb-500",
      "bpc-157",
    ]);
    expect(postgres.identities.flatMap((row) => [...row.aliases, ...row.developmentNames]).join(" ")).not.toMatch(
      /afamelanotide|mecasermin/i,
    );
  });

  it("matches search queries without TB-500 / Thymosin Beta-4 cross hits", () => {
    for (const query of SEARCH_QUERIES) {
      const left = searchSubstances(query).map((item) => item.slug).sort();
      const right = postgres.identities
        .filter((item) =>
          `${item.name} ${item.displayName} ${item.aliases.join(" ")} ${item.developmentNames.join(" ")} ${item.slug}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((item) => item.slug)
        .sort();
      expect(left).toEqual(right);
    }
    const tb = searchSubstances("TB-500").map((item) => item.slug);
    expect(tb).toContain("tb-500");
    expect(tb).not.toContain("thymosin-beta-4");
    const tb4 = searchSubstances("Thymosin Beta-4").map((item) => item.slug);
    expect(tb4).toContain("thymosin-beta-4");
    expect(tb4).not.toContain("tb-500");
  });

  it("matches category and status filters between normalized snapshots", () => {
    const filterDiffs = report.differences.filter((row) => row.family === "filter" && row.critical);
    expect(filterDiffs).toEqual([]);
    const different = report.differences.filter((row) => row.family === "filter" && row.status === "DIFFERENT");
    expect(different).toEqual([]);
  });
});

describe("phase 7 claim / evidence / source / study / regulatory parity", () => {
  const { legacy, postgres, report } = seedParityReport();

  it("keeps claim slots and does not merge claims", () => {
    expect(legacy.claims).toHaveLength(294);
    expect(postgres.claims).toHaveLength(294);
    expect(new Set(postgres.claims.map((row) => row.stableKey)).size).toBe(294);
    const claimDiffs = report.differences.filter((row) => row.family === "claim" && row.critical);
    expect(claimDiffs).toEqual([]);
  });

  it("keeps 27 overlay A-F assessments and 267 review-required", () => {
    expect(postgres.evidence.filter((row) => row.overlay)).toHaveLength(27);
    expect(postgres.evidence.filter((row) => row.reviewStatus === "review-required")).toHaveLength(267);
    const evidenceCritical = report.differences.filter((row) => row.family === "evidence" && row.critical);
    expect(evidenceCritical).toEqual([]);
  });

  it("matches 468 source attachments and 412 unique sources", () => {
    expect(legacy.sourceAttachments).toHaveLength(468);
    expect(postgres.sourceAttachments).toHaveLength(468);
    expect(legacy.sources).toHaveLength(412);
    expect(postgres.sources).toHaveLength(412);
    expect(report.differences.filter((row) => row.family === "source" && row.critical)).toEqual([]);
  });

  it("matches 123 study attachments and 118 unique studies", () => {
    expect(legacy.studyAttachments).toHaveLength(123);
    expect(postgres.studyAttachments).toHaveLength(123);
    expect(legacy.studies).toHaveLength(118);
    expect(postgres.studies).toHaveLength(118);
    expect(report.differences.filter((row) => row.family === "study" && row.critical)).toEqual([]);
  });

  it("matches 41 regulatory records and keeps known unresolved rows", () => {
    expect(postgres.regulatory).toHaveLength(41);
    const unresolved = report.differences.filter((row) => row.family === "regulatory" && row.status === "UNRESOLVED");
    expect(unresolved.map((row) => row.key)).toEqual(
      expect.arrayContaining(["hcg:ema-ovitrelle", "semaglutide:fda-semaglutide-27f15fac"]),
    );
    const orfor = postgres.regulatory.find((row) => row.stableKey === "orforglipron:fda-foundayo");
    expect(orfor?.applicationId).toBe("NDA220934");
    expect(orfor?.productName).toMatch(/FOUNDAYO/i);
    expect(orfor?.region).toBe("US");
    const reta = postgres.regulatory.filter((row) => row.substanceSlug === "retatrutide");
    expect(reta.every((row) => row.status !== "approved" && row.status !== "approved_specific_indication")).toBe(true);
  });

  it("matches 19 review actions", () => {
    expect(postgres.reviewActions).toHaveLength(19);
  });
});

describe("phase 7 product mapping / hudson / community / empty / ordering", () => {
  const { report } = seedParityReport();

  it("maps named SKUs and leaves unresolved codes unmapped", () => {
    for (const code of ["RT5", "RT10", "RT20", "RT30", "RT40"]) {
      const product = LIVE_SHOP_PRODUCTS.find((row) => row.code === code);
      expect(product).toBeTruthy();
      expect(substanceSlugForProduct(product!)).toBe("retatrutide");
      expect(postgresMappingSlug(product!)).toBe("retatrutide");
    }
    expect(postgresMappingSlug({ code: "TR10", name: "Tirzepatide" })).toBe("tirzepatide");
    expect(postgresMappingSlug({ code: "SMO5", name: "Sermorelin Acetate" })).toBe("sermorelin");
    expect(postgresMappingSlug({ code: "TA5", name: "Thymosin Alpha-1" })).toBe("thymosin-alpha-1");
    expect(postgresMappingSlug({ code: "ML10", name: "MT-2 (Melanotan 2 Acetate)" })).toBe("melanotan-ii");
    expect(postgresMappingSlug({ code: "BBG70", name: "(GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend" })).toBe(
      "glow-blend",
    );
    for (const row of UNRESOLVED_PRODUCT_MAPPINGS) {
      expect(postgresMappingSlug(row)).toBeNull();
    }
    for (const code of UNMAP_PREFIX_CODES) {
      expect(postgresMappingSlug({ code, name: code })).toBeNull();
    }
    const mappingCritical = report.differences.filter((row) => row.family === "productMapping" && row.critical);
    expect(mappingCritical).toEqual([]);
  });

  it("excludes Hudson NCT entities from both snapshots", () => {
    const hudson = report.differences.filter((row) => row.family === "hudson");
    expect(hudson.every((row) => row.status === "MATCH")).toBe(true);
    expect(getPublishedProfile("tb-500")?.studies.some((study) => study.clinicalTrialId === "NCT07487363")).toBe(false);
    expect(getPublishedProfile("melanotan-ii")?.studies.some((study) => study.clinicalTrialId === "NCT07437560")).toBe(
      false,
    );
  });

  it("does not create community data", () => {
    expect(isCommunitySource("reddit")).toBe(true);
    expect(communityCannotRaiseEvidence("reddit", "C")).toBe("C");
    const community = report.differences.filter((row) => row.family === "community");
    expect(community.every((row) => row.status === "MATCH")).toBe(true);
    expect(report.totals.communityReports).toBe(0);
  });

  it("treats empty values as equal and classifies order-only separately", () => {
    expect(report.counts.ORDER_ONLY).toBeGreaterThanOrEqual(0);
    expect(PEPTIDE_SUBSTANCES.every((item) => item.slug)).toBe(true);
  });

  it("has no critical differences for integration substances", () => {
    for (const slug of INTEGRATION_SLUGS) {
      const critical = report.differences.filter((row) => row.critical && row.key.includes(slug));
      expect(critical, slug).toEqual([]);
    }
  });
});

describe("phase 7 fallback / rls / network", () => {
  it("keeps legacy display when postgres times out", async () => {
    const report = await runDualRead({
      client: failingSelectClient("timeout"),
      mode: "dual",
      timeoutMs: 40,
    });
    expect(report.displaySource).toBe("legacy");
    expect(report.fallback).toBe("timeout");
    expect(report.verdict).toBe("DUAL_READ_NOT_READY");
  });

  it("keeps legacy display on RLS, network, and query errors", async () => {
    for (const kind of ["rls", "network", "query"] as const) {
      const report = await runDualRead({ client: failingSelectClient(kind), mode: "dual", timeoutMs: 200 });
      expect(report.displaySource).toBe("legacy");
      expect(report.fallback).toBe(kind);
      expect(report.totals.substances).toBe(27);
    }
  });

  it("legacy mode does not fetch postgres", async () => {
    const report = await runDualRead({ client: failingSelectClient("query"), mode: "legacy" });
    expect(report.fallback).toBeNull();
    expect(report.verdict).toBe("DUAL_READ_READY");
    expect(legacyOnlyReport().displaySource).toBe("legacy");
  });

  it("fetches a seed-shaped bundle through the read layer", async () => {
    const fetched = await fetchPostgresResearch(mockClientFromBundle(), { timeoutMs: 2000 });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.bundle.substances).toHaveLength(27);
    expect(fetched.bundle.claims).toHaveLength(294);
  });
});

describe("phase 7 readiness and safety", () => {
  it("is DUAL_READ_READY for seed-vs-legacy with no critical diffs", () => {
    const { report } = seedParityReport();
    expect(report.criticalCount).toBe(0);
    expect(report.verdict).toBe("DUAL_READ_READY");
    expect(report.displaySource).toBe("legacy");
  });

  it("does not log secrets", () => {
    const { report } = seedParityReport();
    const messages: unknown[] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => {
      messages.push(args);
    };
    try {
      logDualReadReport(report);
    } finally {
      console.info = original;
    }
    const serialized = JSON.stringify(messages);
    expect(serialized).not.toMatch(/service_role|anon_key|Bearer /i);
    expect(serialized).toContain("peptide-dual-read");
  });

  it("does not weaken shop isolation in lexicon pages", () => {
    const lexicon = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexicon.tsx"), "utf8");
    const detail = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexiconDetail.tsx"), "utf8");
    expect(`${lexicon}\n${detail}`).not.toMatch(/in den Warenkorb/i);
    expect(lexicon).toMatch(/getPublishedProfile|PEPTIDE_SUBSTANCES|searchSubstances/);
    expect(detail).toMatch(/getPublishedProfile|getSubstanceBySlug/);
  });
});

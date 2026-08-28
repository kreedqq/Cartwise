import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  appendReviewAction,
  mapOverlayRegulatoryStatus,
  productNameFromRegulatoryTitle,
  publishedRegulatorySeed,
  simulateRegulatoryTransition,
} from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { lexiconUsesPostgresRegulatory, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { getPublishedProfile, listPublishedProfiles } from "@/lib/peptide/profiles";
import type { SubstanceProfile } from "@/lib/peptide/profiles/types";

const MIGRATION = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0027_research_regulatory_and_review.sql"),
  "utf8",
);

function payloadBetween(tag: string): string {
  const start = MIGRATION.indexOf(`$${tag}$`);
  const end = MIGRATION.indexOf(`$${tag}$`, start + tag.length + 2);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return MIGRATION.slice(start + tag.length + 2, end).trim();
}

function record(slug: string, sourceId: string) {
  return publishedRegulatorySeed().records.find((row) => row.stableKey === `${slug}:${sourceId}`);
}

describe("research persistence phase 4 regulatory records", () => {
  const seed = publishedRegulatorySeed();

  it("imports one regulatory record per published regulatory source with a reused source id", () => {
    const jsonIds = listPublishedProfiles().flatMap((profile) =>
      profile.sources.filter((source) => source.sourceType === "regulatory").map((source) => `${profile.slug}:${source.id}`),
    );
    expect(jsonIds).toHaveLength(41);
    expect(seed.records).toHaveLength(41);
    expect(new Set(seed.records.map((row) => row.stableKey)).size).toBe(41);
    expect(seed.records.every((row) => row.legacySourceId)).toBe(true);
    expect(seed.history).toEqual([]);
  });

  it("stores region and authority per record, never a global Approved", () => {
    expect(new Set(seed.records.map((row) => row.authority))).toEqual(new Set(["fda", "ema"]));
    expect(new Set(seed.records.map((row) => row.region))).toEqual(new Set(["US", "EU"]));
    expect(seed.records.some((row) => row.authority === "bfarm" || row.authority === "mhra")).toBe(false);
    expect(seed.records.every((row) => row.region !== "unspecified")).toBe(true);
    const tirzepatide = seed.records.filter((row) => row.substanceSlug === "tirzepatide");
    expect(tirzepatide.map((row) => `${row.region}:${row.productName}`).sort()).toEqual([
      "EU:Mounjaro",
      "US:MOUNJARO (TIRZEPATIDE)",
      "US:Zepbound (TIRZEPATIDE)",
    ]);
  });

  it("maps empty FDA/EMA search to overlay status, never not_approved", () => {
    expect(seed.records.filter((row) => row.status === "not_approved")).toHaveLength(0);
    expect(record("retatrutide", "fda-none-retatrutide")?.status).toBe("clinical_development");
    expect(record("tb-500", "fda-none-tb-500")?.status).toBe("insufficient_information");
    expect(record("glow-blend", "fda-none-glow-blend")?.status).toBe("insufficient_information");
    expect(mapOverlayRegulatoryStatus("insufficient")).toBe("insufficient_information");
  });

  it("stores indication and application id only when published notes name them", () => {
    const egrifta = record("tesamorelin", "fda-egrifta");
    expect(egrifta?.applicationId).toBe("BLA022505");
    expect(egrifta?.indication).toMatch(/HIV/i);
    expect(egrifta?.productName).toMatch(/EGRIFTA SV/i);
    expect(record("tirzepatide", "fda-mounjaro")?.applicationId).toBe("NDA215866");
    expect(record("tirzepatide", "fda-zepbound")?.applicationId).toBe("NDA217806");
    expect(record("liraglutide", "ema-victoza")?.applicationId).toBeNull();
    expect(record("liraglutide", "ema-saxenda")?.productName).toBe("Saxenda");
    expect(record("liraglutide", "fda-liraglutide-t2d")?.productName).toMatch(/Liraglutide/i);
    expect(seed.records.filter((row) => row.substanceSlug === "liraglutide").every((row) => row.indication === null)).toBe(
      true,
    );
  });

  it("classifies JSON vs Postgres regulatory sources", () => {
    const sourceRows = seed.reconciliation.filter((row) => !row.jsonRef.endsWith(":overlay") && !row.jsonRef.includes("overlay+"));
    expect(sourceRows.filter((row) => row.status === "MATCH")).toHaveLength(39);
    expect(sourceRows.filter((row) => row.status === "MISSING_IN_POSTGRES")).toHaveLength(0);
    expect(sourceRows.filter((row) => row.status === "MISSING_IN_JSON")).toHaveLength(0);
    expect(sourceRows.filter((row) => row.status === "UNRESOLVED").map((row) => row.jsonRef).sort()).toEqual([
      "hcg:ema-ovitrelle",
      "semaglutide:fda-semaglutide-27f15fac",
    ]);
  });
});

describe("research persistence phase 4 named substances", () => {
  const seed = publishedRegulatorySeed();

  it("keeps Orforglipron FOUNDAYO as current US NDA220934 without inventing an EMA record", () => {
    const foundayo = record("orforglipron", "fda-foundayo");
    expect(foundayo?.authority).toBe("fda");
    expect(foundayo?.region).toBe("US");
    expect(foundayo?.status).toBe("approved_specific_indication");
    expect(foundayo?.productName).toMatch(/FOUNDAYO/i);
    expect(foundayo?.applicationId).toBe("NDA220934");
    expect(foundayo?.isCurrent).toBe(true);
    expect(foundayo?.lastChecked).toBe("2026-08-28");
    expect(seed.records.filter((row) => row.substanceSlug === "orforglipron")).toHaveLength(1);
    expect(getPublishedProfile("orforglipron")?.connectors.find((row) => row.id === "ema")?.status).toBe("unavailable");
  });

  it("does not mark Retatrutide as approved", () => {
    const rows = seed.records.filter((row) => row.substanceSlug === "retatrutide");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("clinical_development");
    expect(rows[0]?.legacySourceId).toBe("fda-none-retatrutide");
    expect(["approved", "approved_specific_indication"].includes(rows[0]?.status ?? "")).toBe(false);
  });

  it("stores Somatropin products regionally (FDA labels + EMA Omnitrope, no invented Norditropin EPAR)", () => {
    const rows = seed.records.filter((row) => row.substanceSlug === "somatropin");
    expect(rows.map((row) => `${row.region}:${row.productName}`).sort()).toEqual([
      "EU:Omnitrope",
      "US:Norditropin (SOMATROPIN)",
      "US:Omnitrope (SOMATROPIN)",
      "US:Serostim (SOMATROPIN)",
    ]);
    expect(record("somatropin", "fda-norditropin")?.applicationId).toBe("BLA021148");
    expect(record("somatropin", "ema-omnitrope")?.applicationId).toBeNull();
    expect(rows.every((row) => row.status === "approved_specific_indication")).toBe(true);
  });

  it("keeps TB-500, Melanotan II, and IGF-1 LR3 identities separate from related INNs", () => {
    expect(record("tb-500", "fda-none-tb-500")?.status).toBe("insufficient_information");
    expect(record("thymosin-beta-4", "fda-none-thymosin-beta-4")?.status).toBe("clinical_development");
    expect(record("tb-500", "fda-none-tb-500")?.legacySourceId).not.toBe(
      record("thymosin-beta-4", "fda-none-thymosin-beta-4")?.legacySourceId,
    );
    expect(record("melanotan-ii", "fda-none-melanotan-ii")?.status).toBe("investigational");
    expect(record("igf-1-lr3", "fda-none-igf-1-lr3")?.status).toBe("investigational");
    expect(seed.records.some((row) => /afamelanotide|scenesse|mecasermin|increlex/i.test(row.productName ?? ""))).toBe(
      false,
    );
  });

  it("does not treat Ovitrelle as a current urinary hCG EU approval", () => {
    const urinary = record("hcg", "fda-hcg");
    const ovitrelle = record("hcg", "ema-ovitrelle");
    expect(urinary?.region).toBe("US");
    expect(urinary?.isCurrent).toBe(true);
    expect(urinary?.applicationId).toBe("BLA017067");
    expect(urinary?.productName).toMatch(/Chorionic Gonadotropin/i);
    expect(ovitrelle?.isCurrent).toBe(false);
    expect(ovitrelle?.reviewStatus).toBe("review-required");
    expect(ovitrelle?.status).toBe("unknown");
    expect(ovitrelle?.productName).toBe("Ovitrelle");
  });

  it("keeps Semaglutide products split by region and does not copy Victoza/Saxenda across INNs", () => {
    expect(record("semaglutide", "ema-ozempic")?.region).toBe("EU");
    expect(record("semaglutide", "ema-wegovy")?.region).toBe("EU");
    expect(record("semaglutide", "fda-ozempic")?.applicationId).toBe("NDA209637");
    expect(record("semaglutide", "fda-semaglutide-27f15fac")?.applicationId).toBe("NDA213051");
    expect(record("semaglutide", "fda-semaglutide-27f15fac")?.reviewStatus).toBe("review-required");
    expect(productNameFromRegulatoryTitle("Ozempic EPAR")).toBe("Ozempic");
  });
});

describe("research persistence phase 4 history and review actions", () => {
  const seed = publishedRegulatorySeed();

  it("has no invented regulatory history and records transitions as new history rows", () => {
    expect(seed.history).toEqual([]);
    const current = record("retatrutide", "fda-none-retatrutide");
    expect(current).toBeTruthy();
    const next = simulateRegulatoryTransition(current!, {
      status: "approved_specific_indication",
      indication: null,
      reason: "hypothetical later approval",
    });
    expect(next.history).toHaveLength(1);
    expect(next.history[0]?.oldStatus).toBe("clinical_development");
    expect(next.history[0]?.newStatus).toBe("approved_specific_indication");
    expect(MIGRATION).toContain("create table public.regulatory_history");
    expect(MIGRATION).toMatch(/on delete restrict/);
    expect(MIGRATION).toContain("regulatory_records_write_history");
  });

  it("seeds request_review actions from published reviewItems without inventing admins", () => {
    const jsonItems = listPublishedProfiles().flatMap((profile) => profile.reviewItems ?? []);
    expect(seed.reviewActions).toHaveLength(jsonItems.length);
    expect(seed.reviewActions.every((row) => row.action === "request_review")).toBe(true);
    expect(seed.reviewActions.every((row) => row.entityType === "substance")).toBe(true);
    expect(seed.reviewActions.some((row) => /Orforglipron|EMA|orforglipron/i.test(row.reason))).toBe(true);
  });

  it("keeps review history append-only", () => {
    const first = seed.reviewActions[0];
    expect(first).toBeTruthy();
    const extra = appendReviewAction(seed.reviewActions, {
      entityType: "claim",
      entityStableKey: "semaglutide:summary.humanEvidence",
      action: "approve",
      previousStatus: "review-required",
      newStatus: "approved",
      reason: "admin decision",
    });
    expect(extra).toHaveLength(seed.reviewActions.length + 1);
    expect(seed.reviewActions).toHaveLength(listPublishedProfiles().flatMap((p) => p.reviewItems ?? []).length);
    expect(MIGRATION).toContain("create policy \"review_actions_insert_admin\"");
    expect(MIGRATION).not.toMatch(/review_actions_update/);
    expect(MIGRATION).not.toMatch(/review_actions_delete/);
    expect(MIGRATION).toContain("grant select, insert on public.review_actions to authenticated");
    expect(MIGRATION).not.toContain("grant select, insert, update, delete on public.review_actions");
  });

  it("authorizes review writes with existing has_role admin, not a new role", () => {
    expect(MIGRATION).toContain("has_role(auth.uid(), 'admin')");
    expect(MIGRATION).not.toContain("has_role(auth.uid(), 'research'");
    expect(MIGRATION).toContain("create policy \"review_actions_select_admin\"");
    expect(MIGRATION).toMatch(/entity_type in \([\s\S]*'claim'[\s\S]*'evidence_assessment'[\s\S]*'regulatory_record'[\s\S]*'research_update'[\s\S]*'substance'/);
  });

  it("does not auto-approve Phase 3 evidence assessments", () => {
    expect(MIGRATION).not.toContain("evidence_assessments");
    expect(MIGRATION).not.toContain("community_reports");
  });
});

describe("research persistence phase 4 sql payload", () => {
  it("embeds the same regulatory and review payloads as the TypeScript seed", () => {
    const seed = publishedRegulatorySeed();
    const sqlRecords = JSON.parse(payloadBetween("phase4_regulatory")) as Array<{ stable_key: string }>;
    const sqlActions = JSON.parse(payloadBetween("phase4_review_actions")) as Array<{ entity_stable_key: string }>;
    expect(sqlRecords).toHaveLength(seed.records.length);
    expect(sqlActions).toHaveLength(seed.reviewActions.length);
    expect(sqlRecords.map((row) => row.stable_key).sort()).toEqual(seed.records.map((row) => row.stableKey).sort());
  });

  it("indexes substance, authority, region, status, and source without a fake global unique status", () => {
    expect(MIGRATION).toContain("regulatory_records_substance_region_idx");
    expect(MIGRATION).toContain("regulatory_records_authority_idx");
    expect(MIGRATION).toContain("regulatory_records_status_idx");
    expect(MIGRATION).toContain("regulatory_records_source_id_idx");
    expect(MIGRATION).toContain("review_actions_entity_idx");
    expect(MIGRATION).toContain("references public.substances");
    expect(MIGRATION).toContain("references public.sources");
    expect(MIGRATION).toContain("references auth.users");
  });
});

describe("research persistence phase 4 dual-read still supports emergency legacy", () => {
  it("defaults to postgres and rolls back with VITE_RESEARCH_DB_MODE=legacy", () => {
    expect(researchDbMode({})).toBe("postgres");
    expect(lexiconUsesPostgresRegulatory({})).toBe(true);
    expect(lexiconUsesPostgresRegulatory({ VITE_RESEARCH_DB_MODE: "legacy" })).toBe(false);
    expect(lexiconUsesPostgresRegulatory({ VITE_RESEARCH_DB_MODE: "postgres" })).toBe(true);
  });
});

describe("research persistence phase 4 published profiles still load", () => {
  it("does not change lexicon published overlays", () => {
    expect(listPublishedProfiles()).toHaveLength(27);
    expect(getPublishedProfile("retatrutide")?.regulatoryStatus).toBe("clinical-development");
    const clone = getPublishedProfile("semaglutide") as SubstanceProfile;
    expect(clone.regulatoryRegions).toEqual(expect.arrayContaining(["US", "EU"]));
  });
});

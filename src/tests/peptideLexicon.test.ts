import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { groupVariantsBySubstance } from "@/lib/peptide/mapping";
import { getIdentitySubstance, getSubstanceBySlug, PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { searchSubstances, substanceSlugForProduct } from "@/lib/peptide/search";
import { communityCannotRaiseEvidence, isCommunitySource } from "@/lib/peptide/types";
import { communityConnectors, redditConnector, scientificConnectors } from "@/research/connectors";
import { canPublish, createResearchDraft } from "@/research/engine";
import { redditQueryTemplates } from "@/research/queries";

describe("peptide lexicon identity", () => {
  it("maps Reta and LY3437943 to retatrutide without claiming approval", () => {
    const byAlias = searchSubstances("Reta");
    const byDev = searchSubstances("LY3437943");
    expect(byAlias.some((item) => item.slug === "retatrutide")).toBe(true);
    expect(byDev.some((item) => item.slug === "retatrutide")).toBe(true);
    const substance = getIdentitySubstance("retatrutide");
    expect(substance?.regulatoryStatus).toBe("insufficient");
    expect(substance?.evidenceLevel).toBe("F");
  });

  it("keeps TB-500 distinct from Thymosin Beta-4", () => {
    expect(getSubstanceBySlug("tb-500")?.slug).toBe("tb-500");
    expect(getSubstanceBySlug("thymosin-beta-4")?.slug).toBe("thymosin-beta-4");
    expect(getSubstanceBySlug("tb-500")?.identityNote).toMatch(/nicht automatisch/i);
  });

  it("keeps Melanotan II distinct from Afamelanotide and IGF-1 LR3 distinct from Mecasermin", () => {
    expect(getSubstanceBySlug("melanotan-ii")?.identityNote).toMatch(/Afamelanotid|Scenesse/i);
    expect(getSubstanceBySlug("igf-1-lr3")?.identityNote).toMatch(/Mecasermin/i);
    expect(getSubstanceBySlug("glow-blend")?.blendComponentSlugs).toEqual(["ghk-cu", "tb-500", "bpc-157"]);
  });

  it("maps RT-prefixed catalog codes to retatrutide and glow blends to components", () => {
    expect(substanceSlugForProduct({ code: "RT10", name: "Retatrutide 10mg" })).toBe("retatrutide");
    expect(substanceSlugForProduct({ code: "GLOW", name: "GHK-Cu TB-500 BPC-157" })).toBe("glow-blend");
    expect(getSubstanceBySlug("glow-blend")?.blendComponentSlugs).toEqual(["ghk-cu", "tb-500", "bpc-157"]);
    const grouped = groupVariantsBySubstance([
      { code: "RT5", name: "Retatrutide 5mg" },
      { code: "RT10", name: "Retatrutide 10mg" },
      { code: "RT10", name: "duplicate" },
      { code: "TZ15", name: "Tirzepatide 15mg" },
    ]);
    expect(grouped.get("retatrutide")?.map((row) => row.code)).toEqual(["RT5", "RT10"]);
    expect(grouped.get("tirzepatide")?.[0]?.code).toBe("TZ15");
  });

  it("does not treat community sources as scientific evidence", () => {
    expect(isCommunitySource("reddit")).toBe(true);
    expect(isCommunitySource("pubmed")).toBe(false);
    expect(communityCannotRaiseEvidence("reddit", "F")).toBe("F");
    expect(PEPTIDE_SUBSTANCES_IDENTITY.every((item) => item.evidenceLevel === "F")).toBe(true);
  });
});

describe("peptide lexicon UI copy", () => {
  it("keeps shop prices and cart actions out of the lexicon", () => {
    const lexicon = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexicon.tsx"), "utf8");
    const detail = readFileSync(resolve(process.cwd(), "src/pages/peptide/PeptideLexiconDetail.tsx"), "utf8");
    const combined = `${lexicon}\n${detail}`;
    expect(combined).not.toMatch(/in den Warenkorb/i);
    expect(combined).not.toMatch(/Price\/Kits/i);
    expect(combined).toMatch(/Keine Preise/);
  });
});

describe("research connectors", () => {
  it("separates scientific and community connectors and does not scrape Reddit", async () => {
    expect(scientificConnectors().every((item) => item.kind === "scientific")).toBe(true);
    expect(communityConnectors().every((item) => item.kind === "community")).toBe(true);
    const reddit = await redditConnector.search({ name: "retatrutide" });
    expect(reddit.ok).toBe(false);
    expect(reddit.message).toMatch(/temporarily unavailable/i);
    expect(reddit.records).toEqual([]);
    expect(redditQueryTemplates("retatrutide")[0]).toBe("retatrutide");
    const draft = createResearchDraft({
      substanceId: "retatrutide",
      updateType: "new_study",
      summary: "Detected candidate, unpublished.",
      importance: "MAJOR",
      scientific: true,
    });
    expect(draft.status).toBe("draft");
    expect(canPublish(draft, false)).toBe(false);
  });
});

describe("peptide routing isolation", () => {
  it("keeps peptide routes outside the shop", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const sidebar = readFileSync(resolve(process.cwd(), "src/components/layout/Sidebar.tsx"), "utf8");
    expect(app).toMatch('path="/peptide"');
    expect(app).toMatch('path="/peptide/rechner"');
    expect(app).toMatch('path="/peptide/lexikon/:slug"');
    expect(app).not.toMatch("/shop/peptide");
    expect(sidebar).toMatch('to: "/peptide"');
  });
});

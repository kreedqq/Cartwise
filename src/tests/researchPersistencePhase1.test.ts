import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PEPTIDE_SUBSTANCES_IDENTITY, getIdentitySubstance, getSubstanceBySlug } from "@/lib/peptide/catalog";
import {
  assertIdentitySeparations,
  identitySeedFromCatalog,
} from "@/lib/peptide/persistence/identitySeed";
import { lexiconUsesPostgresIdentity, researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { PRODUCT_CODE_PREFIX_RULES, substanceSlugForProduct } from "@/lib/peptide/search";

const MIGRATION = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0024_research_identity_and_product_mapping.sql"),
  "utf8",
);

describe("research persistence phase 1 identity seed", () => {
  const seed = identitySeedFromCatalog();

  it("creates one identity row per catalog substance without evidence levels", () => {
    expect(seed).toHaveLength(PEPTIDE_SUBSTANCES_IDENTITY.length);
    expect(seed).toHaveLength(27);
    expect(seed.every((row) => row.casNumber === null && row.chemicalClass === null)).toBe(true);
    expect(seed.map((row) => row.slug).sort()).toEqual(
      [...PEPTIDE_SUBSTANCES_IDENTITY].map((item) => item.slug).sort(),
    );
  });

  it("keeps aliases unique and maps development names separately", () => {
    const aliases = seed.flatMap((row) => row.aliases.map((entry) => entry.alias.toLowerCase().trim()));
    expect(aliases).toHaveLength(46);
    expect(new Set(seed.map((row) => row.slug)).size).toBe(27);
    expect(new Set(aliases).size).toBe(aliases.length);
    const reta = seed.find((row) => row.slug === "retatrutide");
    expect(reta?.aliases).toEqual(
      expect.arrayContaining([
        { alias: "Reta", aliasType: "common_name" },
        { alias: "LY3437943", aliasType: "development_name" },
      ]),
    );
    expect(assertIdentitySeparations(seed)).toBeUndefined();
  });

  it("keeps TB-500, Melanotan II, IGF-1 LR3 and glow-blend distinct", () => {
    expect(getIdentitySubstance("tb-500")?.slug).not.toBe(getIdentitySubstance("thymosin-beta-4")?.slug);
    expect(MIGRATION).toMatch(/'tb-500'/);
    expect(MIGRATION).toMatch(/'thymosin-beta-4'/);
    expect(MIGRATION).toMatch(/nicht automatisch mit Afamelanotid/);
    expect(MIGRATION).not.toMatch(/'afamelanotide'/i);
    expect(MIGRATION).not.toMatch(/'mecasermin'/i);
    expect(MIGRATION).toMatch(/Mecasermin/);
    expect(seed.find((row) => row.slug === "glow-blend")?.status).toBe("blend");
    expect(seed.find((row) => row.slug === "glow-blend")?.componentSlugs).toEqual(["ghk-cu", "tb-500", "bpc-157"]);
    expect(getSubstanceBySlug("glow-blend")?.blendComponentSlugs).toEqual(["ghk-cu", "tb-500", "bpc-157"]);
  });

  it("embeds every catalog slug and alias in the SQL migration", () => {
    for (const row of seed) {
      expect(MIGRATION).toContain(`'${row.slug}'`);
      for (const entry of row.aliases) {
        expect(MIGRATION).toContain(`'${entry.alias}'`);
      }
    }
    expect(MIGRATION.match(/insert into public\.substances/i)).toBeTruthy();
    expect((MIGRATION.match(/glow-blend', 'ghk-cu'/g) ?? []).length).toBeGreaterThan(0);
  });
});

describe("research persistence phase 1 product mapping", () => {
  it("maps RT catalog codes to retatrutide without guessing other SKUs", () => {
    for (const code of ["RT5", "RT10", "RT20", "RT30", "RT40"]) {
      expect(substanceSlugForProduct({ code, name: `Retatrutide ${code}` })).toBe("retatrutide");
    }
    expect(PRODUCT_CODE_PREFIX_RULES.some((rule) => rule.slug === "retatrutide" && rule.test.test("RT10"))).toBe(
      true,
    );
    expect(substanceSlugForProduct({ code: "UNKNOWN99", name: "Mystery vial" })).toBeNull();
  });

  it("maps glow blends by name to the blend substance, not a fake INN", () => {
    expect(substanceSlugForProduct({ code: "GLOW", name: "GHK-Cu TB-500 BPC-157" })).toBe("glow-blend");
    expect(MIGRATION).toMatch(/mapping_method in \('prefix', 'name', 'manual'\)/);
    expect(MIGRATION).toMatch(/refresh_product_substance_prefix_mappings/);
  });
});

describe("research persistence phase 1 dual-read flag", () => {
  it("defaults to legacy so the lexicon does not switch to Postgres", () => {
    expect(researchDbMode({ })).toBe("legacy");
    expect(lexiconUsesPostgresIdentity({ })).toBe(false);
    expect(researchDbMode({ VITE_RESEARCH_DB_MODE: "postgres" })).toBe("postgres");
  });
});

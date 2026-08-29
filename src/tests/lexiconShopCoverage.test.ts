import { describe, expect, it } from "vitest";

import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import { catalogNamesForSlug, familySlugForCatalogName } from "@/lib/peptide/shopCoverage/names";
import { coverageReportSummary, shopCoverageMatrix } from "@/lib/peptide/shopCoverage/coverage";
import { isExactCatalogName } from "@/lib/peptide/shopCoverage/formClass";
import { loadShopCatalogProducts } from "@/lib/peptide/shopCoverage/loadProducts";

describe("lexicon shop coverage matrix", () => {
  it("covers all 320 live shop SKUs", () => {
    const products = loadShopCatalogProducts();
    expect(products).toHaveLength(320);
    expect(LIVE_SHOP_PRODUCTS).toHaveLength(320);
    const rows = shopCoverageMatrix(products);
    expect(rows).toHaveLength(320);
    expect(new Set(rows.map((row) => row.code.toUpperCase())).size).toBe(320);
  });

  it("maps every catalog name through an exact name group", () => {
    for (const product of LIVE_SHOP_PRODUCTS) {
      expect(isExactCatalogName(product.name), product.code).toBe(true);
      const slug = familySlugForCatalogName(product.name);
      expect(catalogNamesForSlug(slug).length, `${product.code} ${slug}`).toBeGreaterThan(0);
    }
  });

  it("keeps identity-unsafe SKUs in review-required", () => {
    const rows = shopCoverageMatrix();
    const bt5 = rows.find((row) => row.code === "BT5");
    expect(bt5?.status).toBe("REVIEW_REQUIRED");
    expect(bt5?.mappingUnique).toBe("nein");
    expect(bt5?.researchSlug).toBeNull();

    const ml10 = rows.find((row) => row.code === "ML10");
    expect(ml10?.status).toBe("COMPLETE");
    expect(ml10?.researchSlug).toBe("melanotan-ii");
  });

  it("treats BAC and AA water as non-lexicon hilfsstoffe", () => {
    const rows = shopCoverageMatrix();
    for (const code of ["BA03", "BA10", "AA10"]) {
      const row = rows.find((item) => item.code === code);
      expect(row?.coverageCategory).toBe("HILFSSTOFFE");
      expect(row?.status).toBe("NON_LEXICON");
      expect(row?.lexiconProfileRequired).toBe("nein");
    }
  });

  it("groups tesamorelin and semax variants onto one family slug", () => {
    const rows = shopCoverageMatrix();
    const tsm = rows.filter((row) => ["TSM5", "TSM10", "TSM20"].includes(row.code));
    expect(new Set(tsm.map((row) => row.familySlug))).toEqual(new Set(["tesamorelin"]));

    const semax = rows.filter((row) => ["XA5", "XA10", "XA30"].includes(row.code));
    expect(new Set(semax.map((row) => row.familySlug))).toEqual(new Set(["semax"]));
  });

  it("summarizes expected coverage buckets", () => {
    const summary = coverageReportSummary();
    expect(summary.shopProductsTotal).toBe(320);
    expect(summary.complete).toBeGreaterThan(70);
    expect(summary.partial).toBeGreaterThan(150);
    expect(summary.reviewRequired).toBe(19);
    expect(summary.nonLexicon).toBe(3);
    expect(summary.unknown).toBe(11);
  });
});

import { describe, expect, it } from "vitest";

import { effectiveCategoryKeyForProduct } from "@/lib/shop/areaCategories";
import { PEPTIX_CANONICAL_VIAL_PATH } from "@/lib/shop/portalTheme";
import {
  resolveProductMedia,
  resolveProductMediaCandidates,
  type ResolveProductMediaInput,
} from "@/lib/shop/productMedia";

describe("resolveProductMedia", () => {
  const categoryMedia = {
    peptides: "design-studio/categories/peptides/a.jpg",
    "injectable-oils": "design-studio/categories/injectable-oils/b.jpg",
    orals: "design-studio/categories/orals/c.jpg",
    "reconstitution-water": "design-studio/categories/reconstitution-water/d.jpg",
  };

  it("uses product image when present", () => {
    const r = resolveProductMedia({
      productName: "Retatrutide",
      productImagePath: "products/reta.jpg",
      effectiveCategoryKey: "peptides",
      categoryMedia,
    });
    expect(r.kind).toBe("product");
    expect(r.src).toContain("products/reta.jpg");
    expect(r.alt).toBe("Retatrutide");
  });

  it("uses category media when product image missing", () => {
    const r = resolveProductMedia({
      productName: "Semax",
      productImagePath: null,
      effectiveCategoryKey: "peptides",
      categoryMedia,
    });
    expect(r.kind).toBe("category");
    expect(r.alt).toBe("Peptides Kategorie");
  });

  it("falls back to canonical vial when category media missing", () => {
    const r = resolveProductMedia({
      productName: "Semax",
      productImagePath: null,
      effectiveCategoryKey: "peptides",
      categoryMedia: {},
    });
    expect(r.kind).toBe("canonical");
    expect(r.src).toBe(PEPTIX_CANONICAL_VIAL_PATH);
  });

  it("uses global vial before canonical when configured", () => {
    const r = resolveProductMedia({
      productName: "Semax",
      productImagePath: null,
      effectiveCategoryKey: "peptides",
      categoryMedia: {},
      globalVialPath: "design-studio/vials/custom.jpg",
    });
    expect(r.kind).toBe("global-vial");
  });

  it("maps each category key to its category image", () => {
    for (const key of ["peptides", "injectable-oils", "orals", "reconstitution-water"] as const) {
      const r = resolveProductMedia({
        productName: "Sample",
        productImagePath: null,
        effectiveCategoryKey: key,
        categoryMedia,
      });
      expect(r.kind).toBe("category");
      expect(r.src).toContain(key);
    }
  });

  it("uses accessories category media with explicit label", () => {
    const r = resolveProductMedia({
      productName: "Spritzen",
      productImagePath: null,
      effectiveCategoryKey: "accessories",
      categoryLabel: "Zubehör",
      categoryMedia: {
        ...categoryMedia,
        accessories: "design-studio/categories/accessories/z.jpg",
      },
    });
    expect(r.kind).toBe("category");
    expect(r.alt).toBe("Zubehör Kategorie");
    expect(r.src).toContain("accessories");
  });

  it("product image wins over category image", () => {
    const r = resolveProductMedia({
      productName: "Custom Oil",
      productImagePath: "products/oil.jpg",
      effectiveCategoryKey: "injectable-oils",
      categoryMedia,
    });
    expect(r.kind).toBe("product");
  });
});

describe("resolveProductMediaCandidates (load-error fallback chain)", () => {
  const categoryMedia = {
    peptides: "design-studio/categories/peptides/a.jpg",
  };

  const base = {
    productName: "Semax",
    effectiveCategoryKey: "peptides" as const,
    categoryMedia,
  };

  function activeAfterFailures(failures: number, input: ResolveProductMediaInput = base) {
    const chain = resolveProductMediaCandidates(input);
    return chain[failures] ?? null;
  }

  it("1 — product URL present → product is first candidate", () => {
    const chain = resolveProductMediaCandidates({
      ...base,
      productImagePath: "products/hero.jpg",
    });
    expect(chain[0]?.kind).toBe("product");
  });

  it("2 — product missing, category present → category is first", () => {
    const chain = resolveProductMediaCandidates({ ...base, productImagePath: null });
    expect(chain[0]?.kind).toBe("category");
  });

  it("3 — product missing, category URL configured → vial after category failure", () => {
    const chain = resolveProductMediaCandidates({ ...base, productImagePath: null, categoryMedia });
    expect(chain[0]?.kind).toBe("category");
    expect(activeAfterFailures(1)?.kind).toBe("canonical");
  });

  it("4 — product missing, category missing → vial first", () => {
    const chain = resolveProductMediaCandidates({ ...base, productImagePath: null, categoryMedia: {} });
    expect(chain[0]?.kind).toBe("canonical");
  });

  it("5 — all URLs fail through chain → no candidate after last (placeholder in UI)", () => {
    const input = { ...base, productImagePath: null, categoryMedia: {} };
    const chain = resolveProductMediaCandidates(input);
    expect(chain).toHaveLength(1);
    expect(activeAfterFailures(1, input)).toBeNull();
  });

  it("6 — product fails → category is next", () => {
    const withProduct = { ...base, productImagePath: "products/hero.jpg" };
    const chain = resolveProductMediaCandidates(withProduct);
    expect(chain[0]?.kind).toBe("product");
    expect(activeAfterFailures(1, withProduct)?.kind).toBe("category");
  });

  it("7 — product and category fail → vial is next", () => {
    const withProduct = { ...base, productImagePath: "products/hero.jpg" };
    expect(activeAfterFailures(2, withProduct)?.kind).toBe("canonical");
  });

  it("8 — duplicate URLs deduped (no second fallback stage)", () => {
    const shared = "design-studio/shared/same.jpg";
    const chain = resolveProductMediaCandidates({
      productName: "Dup",
      productImagePath: null,
      effectiveCategoryKey: "peptides",
      categoryMedia: { peptides: shared },
      globalVialPath: shared,
    });
    expect(chain.map((c) => c.kind)).toEqual(["category", "canonical"]);
  });
});

describe("effectiveCategoryKeyForProduct", () => {
  it("resolves vendor catalog assignment by product id", () => {
    const key = effectiveCategoryKeyForProduct(
      { id: "p1", code: "LC120" },
      [{ product_id: "p1", category_key: "injectable-oils" }],
    );
    expect(key).toBe("injectable-oils");
  });
});

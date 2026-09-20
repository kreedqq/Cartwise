import { describe, expect, it } from "vitest";

import {
  buildDesignStudioCategoryRegistry,
  categoryDisplayLabelForKey,
  humanizeCategoryKey,
} from "@/lib/designStudioCategories";

describe("buildDesignStudioCategoryRegistry", () => {
  it("includes all distinct area category keys with stable sort", () => {
    const registry = buildDesignStudioCategoryRegistry({
      areaCategoryRows: [
        { category_key: "peptides", label: "Peptides", sort_order: 0 },
        { category_key: "accessories", label: "Zubehör", sort_order: 4 },
        { category_key: "peptides", label: "Peptides GB2", sort_order: 0 },
      ],
    });
    const keys = registry.map((r) => r.key);
    expect(keys).toContain("peptides");
    expect(keys).toContain("accessories");
    expect(registry.find((r) => r.key === "accessories")?.label).toBe("Zubehör");
    expect(keys.indexOf("peptides")).toBeLessThan(keys.indexOf("accessories"));
  });

  it("merges categoryMedia-only keys without dropping existing config keys", () => {
    const registry = buildDesignStudioCategoryRegistry({
      areaCategoryRows: [{ category_key: "peptides", label: "Peptides", sort_order: 0 }],
      categoryMedia: {
        peptides: "design-studio/categories/peptides/a.jpg",
        "laboratory-equipment": "design-studio/categories/laboratory-equipment/x.jpg",
      },
    });
    expect(registry.map((r) => r.key)).toEqual(
      expect.arrayContaining(["peptides", "laboratory-equipment"]),
    );
  });

  it("does not use a fixed four-key whitelist", () => {
    const registry = buildDesignStudioCategoryRegistry({
      areaCategoryRows: [
        { category_key: "accessories", label: "Zubehör", sort_order: 1 },
        { category_key: "packaging", label: "Verpackung", sort_order: 2 },
      ],
      categoryMedia: {},
      seedKeys: [],
    });
    expect(registry).toHaveLength(2);
    expect(registry.every((r) => r.headline.length > 0)).toBe(true);
  });

  it("uses min sort_order across areas for ordering", () => {
    const registry = buildDesignStudioCategoryRegistry({
      areaCategoryRows: [
        { category_key: "orals", label: "Orals", sort_order: 3 },
        { category_key: "orals", label: "Orals GB", sort_order: 1 },
        { category_key: "peptides", label: "Peptides", sort_order: 0 },
      ],
    });
    expect(registry[0]?.key).toBe("peptides");
    expect(registry.some((r) => r.key === "orals")).toBe(true);
  });
});

describe("categoryDisplayLabelForKey", () => {
  it("uses legacy shop category labels", () => {
    expect(categoryDisplayLabelForKey("peptides")).toBe("Peptides");
  });

  it("humanizes unknown keys", () => {
    expect(categoryDisplayLabelForKey("accessories")).toBe("Accessories");
    expect(humanizeCategoryKey("laboratory-equipment")).toBe("Laboratory Equipment");
  });

  it("prefers explicit label map", () => {
    expect(categoryDisplayLabelForKey("accessories", { accessories: "Zubehör" })).toBe("Zubehör");
  });
});

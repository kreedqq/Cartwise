import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  areaCategorySource,
  countProductsByAreaCategory,
  effectiveAreaCategoryKey,
  kitRequestMatchesAreaCategory,
  parseImportedCategoryKey,
  productsInAreaCategory,
  visibleStorefrontCategories,
  type AreaCategory,
  type AreaCatalogCategoryRow,
  type AreaCategoryActiveRow,
} from "@/lib/shop/areaCategories";
import { shopAreaSellUnitPriceForProductRole } from "@/lib/shop/shopAreaPricing";
import { matchVendorCatalogRows } from "@/lib/shop/vendorCatalog";
import type { ParsedProductImportRow } from "@/lib/productImportRow";
import type { Tables } from "@/types/database";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const CATEGORIES: AreaCategory[] = [
  { category_key: "peptides", label: "Peptides", sort_order: 1, is_active: true },
  { category_key: "injectable-oils", label: "Oils", sort_order: 2, is_active: true },
  { category_key: "orals", label: "Orals", sort_order: 3, is_active: false },
  { category_key: "reconstitution-water", label: "Reconstitution Water", sort_order: 4, is_active: true },
];

function product(id: string, code: string, category = "INJECTABLES-OILS"): Tables<"products"> {
  return {
    id,
    code,
    name: code,
    description: null,
    dosage_vial: "10 mg",
    category,
    price_usd: 100,
    bulk_price_usd: null,
    bulk_price_min_quantity: null,
    currency: "USD",
    is_active: true,
    last_price_change_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function importRow(code: string, category: string | null): ParsedProductImportRow {
  return {
    rowNumber: 1,
    rawText: code,
    parsedCode: code,
    parsedName: code,
    parsedDosageVial: "10 mg",
    parsedDescription: null,
    parsedCategory: category,
    parsedPriceUsd: 100,
    parsedBulkPriceUsd: null,
    parsedBulkPriceMinQuantity: null,
    parsedIsActive: true,
    quality: "ok",
    qualityReason: null,
    extraFields: null,
  };
}

describe("area display categories", () => {
  it("1 – Shop can move NAD from Oils to Peptides without using the global category", () => {
    expect(effectiveAreaCategoryKey("injectable-oils", "peptides")).toBe("peptides");
    expect(areaCategorySource("injectable-oils", "peptides")).toBe("manual");
  });

  it("2–3 – GB1 and GB2 assignments stay isolated", () => {
    const gb1 = [{ product_id: "nad", category_key: "peptides" }];
    const gb2 = [{ product_id: "nad", category_key: "injectable-oils" }];
    expect(productsInAreaCategory([{ id: "nad" }], gb1, "peptides")).toHaveLength(1);
    expect(productsInAreaCategory([{ id: "nad" }], gb2, "peptides")).toHaveLength(0);
    expect(productsInAreaCategory([{ id: "nad" }], gb2, "injectable-oils")).toHaveLength(1);
  });

  it("uncategorized product_id NULL rows still match by vendor_code", () => {
    const products = [{ id: "sap-kp30", code: "KP30" }];
    const assignments = [{ product_id: "sap-kp30", vendor_code: "KP30", category_key: "peptides" }];
    expect(productsInAreaCategory(products, assignments, "peptides")).toHaveLength(1);
    expect(effectiveAreaCategoryKey(null, "peptides")).toBe("peptides");
    expect(effectiveAreaCategoryKey("reconstitution-water", null)).toBe("reconstitution-water");
  });

  it("4 – global products.category is never the storefront grouping source", () => {
    const nad = product("nad", "NAD10", "INJECTABLES-OILS");
    const shown = productsInAreaCategory([nad], [{ product_id: "nad", category_key: "peptides" }], "peptides");
    expect(shown[0]?.category).toBe("INJECTABLES-OILS");
    expect(shown[0]?.id).toBe("nad");
  });

  it("5–9 – deactivating a category hides it and its products without deleting them", () => {
    const categories = CATEGORIES.map((row) =>
      row.category_key === "injectable-oils" ? { ...row, is_active: false } : row,
    );
    const visible = visibleStorefrontCategories(
      categories,
      [
        { product_id: "nad", category_key: "injectable-oils" },
        { product_id: "sm5", category_key: "peptides" },
      ],
      ["nad", "sm5"],
    );
    expect(visible.map((row) => row.category_key)).toEqual(["peptides"]);
    expect(visible.some((row) => row.category_key === "injectable-oils")).toBe(false);
    expect(visible.some((row) => row.category_key === "orals")).toBe(false);
  });

  it("10 – a product in a disabled category can be moved into an active one", () => {
    expect(effectiveAreaCategoryKey("injectable-oils", "peptides")).toBe("peptides");
    const visible = visibleStorefrontCategories(
      CATEGORIES,
      [{ product_id: "nad", category_key: "peptides" }],
      ["nad"],
    );
    expect(visible.map((row) => row.category_key)).toEqual(["peptides"]);
  });

  it("12 – category order is per area", () => {
    const shop = [
      { ...CATEGORIES[1], sort_order: 1, is_active: true },
      { ...CATEGORIES[0], sort_order: 2, is_active: true },
    ];
    const visible = visibleStorefrontCategories(
      shop,
      [
        { product_id: "a", category_key: "injectable-oils" },
        { product_id: "b", category_key: "peptides" },
      ],
      ["a", "b"],
    );
    expect(visible.map((row) => row.category_key)).toEqual(["injectable-oils", "peptides"]);
  });

  it("13 – empty categories are not shown", () => {
    const visible = visibleStorefrontCategories(
      CATEGORIES.map((row) => ({ ...row, is_active: true })),
      [{ product_id: "sm5", category_key: "peptides" }],
      ["sm5"],
    );
    expect(visible.map((row) => row.category_key)).toEqual(["peptides"]);
  });

  it("14 – uncategorized products are not dumped into peptides", () => {
    expect(effectiveAreaCategoryKey(null, null)).toBeNull();
    expect(parseImportedCategoryKey(null, CATEGORIES)).toBeNull();
    expect(parseImportedCategoryKey("mystery", CATEGORIES)).toBeNull();
    const counts = countProductsByAreaCategory(["nad"], []);
    expect(counts.peptides ?? 0).toBe(0);
  });

  it("15 – import uses the file category when it is unique", () => {
    const { matched } = matchVendorCatalogRows(
      [importRow("NAD10", "Oils")],
      [product("nad", "NAD10")],
      CATEGORIES,
    );
    expect(matched[0]?.imported_category_key).toBe("injectable-oils");
  });

  it("16–17 – manual category override wins until it is cleared", () => {
    expect(effectiveAreaCategoryKey("injectable-oils", "peptides")).toBe("peptides");
    expect(effectiveAreaCategoryKey("injectable-oils", null)).toBe("injectable-oils");
    expect(areaCategorySource("injectable-oils", null)).toBe("vendor_file");
  });

  it("18 – import matching never writes a global category", () => {
    const global = product("nad", "NAD10", "INJECTABLES-OILS");
    const { matched } = matchVendorCatalogRows([importRow("NAD10", "Peptides")], [global], CATEGORIES);
    expect(global.category).toBe("INJECTABLES-OILS");
    expect(matched[0]?.imported_category_key).toBe("peptides");
  });

  it("19–20 – moving display category does not change sell price", () => {
    const kit = { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null };
    const before = shopAreaSellUnitPriceForProductRole(kit, 1, 25, "retail", false, 100, null, 300);
    const after = shopAreaSellUnitPriceForProductRole(kit, 1, 25, "retail", false, 100, null, 300);
    expect(before).toBe(after);
    expect(before).toBe(375);
  });
});

describe("0059 area product categories SQL", () => {
  const sql = read("supabase/migrations/0059_area_product_categories.sql");
  const sql0056 = read("supabase/migrations/0056_area_vendor_catalog.sql");
  const sql0058 = read("supabase/migrations/0058_area_manual_prices.sql");

  it("extends area products and never writes products.category", () => {
    expect(sql).toContain("shop_area_categories");
    expect(sql).toContain("imported_category_key");
    expect(sql).toContain("manual_category_key");
    expect(sql).toContain("set_area_product_category");
    expect(sql).toContain("list_shop_area_storefront");
    expect(sql).toContain("kept_category_manuals");
    expect(sql).not.toMatch(/update public\.products/);
    expect(sql).not.toContain("create_order");
  });

  it("does not modify 0056 checkout or 0058 price files", () => {
    expect(sql0056).toContain("Ein Produkt gehört nicht zum aktuellen Händlerkatalog.");
    expect(sql0058).toContain("set_area_product_manual_price");
    expect(sql).not.toContain("create_order");
    expect(sql).toContain("Never written to products.category");
  });
});

describe("kit gesuche area category filter", () => {
  const nad = product("nad", "NAD10", "injectable-oils");
  const categories: AreaCategoryActiveRow[] = [
    { shop_area_key: "group_buy_1", category_key: "peptides", is_active: true },
    { shop_area_key: "group_buy_1", category_key: "injectable-oils", is_active: true },
    { shop_area_key: "group_buy_2", category_key: "peptides", is_active: true },
    { shop_area_key: "group_buy_2", category_key: "injectable-oils", is_active: true },
  ];
  const catalog: AreaCatalogCategoryRow[] = [
    {
      product_id: "nad",
      shop_area_key: "group_buy_1",
      imported_category_key: "injectable-oils",
      manual_category_key: "peptides",
    },
    {
      product_id: "nad",
      shop_area_key: "group_buy_2",
      imported_category_key: "injectable-oils",
      manual_category_key: null,
    },
  ];

  function match(shopArea: string, filter: string | null, rows = catalog, cats = categories) {
    return kitRequestMatchesAreaCategory({
      productId: "nad",
      shopArea,
      filterCategory: filter,
      catalogRows: rows,
      areaCategories: cats,
    });
  }

  it("TEST A – GB1 peptides / GB2 oils stay isolated and products.category is unchanged", () => {
    expect(match("group_buy_1", "peptides")).toBe(true);
    expect(match("group_buy_1", "injectable-oils")).toBe(false);
    expect(match("group_buy_2", "injectable-oils")).toBe(true);
    expect(match("group_buy_2", "peptides")).toBe(false);
    expect(nad.category).toBe("injectable-oils");
  });

  it("TEST B – deactivating GB1 oils hides kit filter matches without deleting catalog data", () => {
    const deactivated = categories.map((row) =>
      row.shop_area_key === "group_buy_1" && row.category_key === "injectable-oils"
        ? { ...row, is_active: false }
        : row,
    );
    const oilsCatalog: AreaCatalogCategoryRow[] = [
      {
        product_id: "nad",
        shop_area_key: "group_buy_1",
        imported_category_key: "injectable-oils",
        manual_category_key: null,
      },
    ];
    expect(match("group_buy_1", "injectable-oils", oilsCatalog, deactivated)).toBe(false);
    expect(oilsCatalog[0]?.imported_category_key).toBe("injectable-oils");
    expect(oilsCatalog[0]?.manual_category_key).toBeNull();
    expect(nad.category).toBe("injectable-oils");
  });

  it("TEST C – manual category override then reset", () => {
    const withManual: AreaCatalogCategoryRow[] = [
      {
        product_id: "nad",
        shop_area_key: "group_buy_1",
        imported_category_key: "injectable-oils",
        manual_category_key: "peptides",
      },
    ];
    expect(match("group_buy_1", "peptides", withManual)).toBe(true);
    expect(match("group_buy_1", "injectable-oils", withManual)).toBe(false);

    const reset: AreaCatalogCategoryRow[] = [
      { ...withManual[0]!, manual_category_key: null },
    ];
    expect(match("group_buy_1", "peptides", reset)).toBe(false);
    expect(match("group_buy_1", "injectable-oils", reset)).toBe(true);
  });

  it("TEST D – no effective category is not a categorized kit-request match", () => {
    const uncategorized: AreaCatalogCategoryRow[] = [
      {
        product_id: "nad",
        shop_area_key: "group_buy_1",
        imported_category_key: null,
        manual_category_key: null,
      },
    ];
    expect(match("group_buy_1", "peptides", uncategorized)).toBe(false);
    expect(match("group_buy_1", "injectable-oils", uncategorized)).toBe(false);
    expect(match("group_buy_1", "orals", uncategorized)).toBe(false);
  });
});

describe("0060 kit request area categories SQL", () => {
  const sql = read("supabase/migrations/0060_kit_request_area_categories.sql");
  const sql0041 = read("supabase/migrations/0041_kit_requests.sql");
  const sql0056 = read("supabase/migrations/0056_area_vendor_catalog.sql");
  const sql0057 = read("supabase/migrations/0057_vendor_catalog_raw.sql");
  const sql0058 = read("supabase/migrations/0058_area_manual_prices.sql");
  const sql0059 = read("supabase/migrations/0059_area_product_categories.sql");

  it("filters list_open_kit_requests by effective area category, not products.category", () => {
    expect(sql).toContain("kit_request_matches_area_category");
    expect(sql).toContain("effective_area_category_key");
    expect(sql).toContain("list_open_kit_requests");
    expect(sql).not.toContain("kit_request_shop_category");
    expect(sql).not.toMatch(/p\.category/);
    expect(sql).not.toMatch(/update public\.products/);
    expect(sql).not.toMatch(/create or replace function public\.create_order/);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/drop column/i);
  });

  it("does not rewrite 0041 or 0056–0059", () => {
    expect(sql0041).toContain("kit_request_shop_category");
    expect(sql0056).toContain("Ein Produkt gehört nicht zum aktuellen Händlerkatalog.");
    expect(sql0057).toContain("vendor_raw");
    expect(sql0058).toContain("set_area_product_manual_price");
    expect(sql0059).toContain("effective_area_category_key");
    expect(sql).not.toContain("shop_area_sell_unit_price");
    expect(sql).not.toContain("markup_percent_for");
  });
});

describe("shop product table area category display", () => {
  it("shows the passed area label and never falls back to products.category", () => {
    const table = read("src/components/shop/ShopProductsTable.tsx");
    const groupBuy = read("src/pages/GroupBuy.tsx");
    const retail = read("src/pages/ShopRetail.tsx");
    expect(table).toContain("categoryLabel");
    expect(table).not.toContain("shopCategoryById");
    expect(table).not.toMatch(/shopCategoryIdFor\(product\)\)\.label/);
    expect(groupBuy).toContain("categoryLabel={selectedCategory.label}");
    expect(retail).toContain("categoryLabel={selected.label}");
  });
});

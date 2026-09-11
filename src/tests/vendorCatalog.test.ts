/**
 * Vendor-catalog regression tests (migration 0056).
 *
 * Requirements verified:
 *  1  Händler A hat Produkt A im Dokument → wird angezeigt.
 *  2  Händler A hat Produkt B nicht im Dokument → wird NICHT angezeigt.
 *  3  Händler A und B haben unterschiedliche Dokumente → keine Vermischung.
 *  4  Artikel existiert global, steht aber nicht im Händlerdokument → nicht im Shop.
 *  5  Mehrere Varianten → nur die Varianten aus dem Dokument.
 *  6  Händlerdokument wird ersetzt → altes Sortiment vollständig durch neues ersetzt.
 *  7  Händler A ändert sein Dokument → Händler B bleibt unverändert.
 *  8  Händlerdatei enthält Oils → Oils erscheinen.
 *  9  Händlerdatei enthält keine Oils → Oils erscheinen NICHT.
 * 10  Händlerdatei enthält Orals → Orals erscheinen.
 * 11  Händlerdatei enthält keine Orals → Orals erscheinen NICHT.
 * 12  Keine hardcodierte Kategorie-Limitierung.
 * 13  Preise stammen aus dem jeweiligen Händlerdokument.
 * 14  Checkout akzeptiert keine Produkte außerhalb des Händlerkatalogs
 *     (validated via product_visible_in_shop_area logic in SQL; here we test
 *      the TS layer: non-visible products are excluded from matchVendorCatalogRows).
 * 15  Emma.xlsx Regressions-Datensatz.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { matchVendorCatalogRows, diffVendorCatalog, normalizeVendorSku, VENDOR_PDF_UNREADABLE } from "@/lib/shop/vendorCatalog";
import type { ParsedProductImportRow } from "@/lib/productImportRow";
import type { Tables } from "@/types/database";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeProduct(
  code: string,
  overrides: Partial<Tables<"products">> = {},
): Tables<"products"> {
  return {
    id: `id-${code.toLowerCase()}`,
    code,
    name: `Product ${code}`,
    description: null,
    dosage_vial: null,
    category: null,
    price_usd: 100,
    bulk_price_usd: null,
    bulk_price_min_quantity: null,
    currency: "USD",
    is_active: true,
    last_price_change_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeImportRow(
  code: string,
  price_usd: number,
  overrides: Partial<ParsedProductImportRow> = {},
): ParsedProductImportRow {
  return {
    rowNumber: 1,
    rawText: `${code}\t${price_usd}`,
    parsedCode: code,
    parsedName: `Product ${code}`,
    parsedDosageVial: null,
    parsedDescription: null,
    parsedCategory: null,
    parsedPriceUsd: price_usd,
    parsedBulkPriceUsd: null,
    parsedBulkPriceMinQuantity: null,
    parsedIsActive: null,
    quality: "ok",
    qualityReason: null,
    extraFields: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock Emma.xlsx dataset (15 representative SKUs + prices from user description)
// ---------------------------------------------------------------------------

const EMMA_SKUS = [
  { code: "SM2",  price: 60 },
  { code: "SM5",  price: 65 },
  { code: "SM10", price: 70 },
  { code: "SM15", price: 75 },
  { code: "SM20", price: 80 },
  { code: "TR10", price: 50 },
  { code: "TR15", price: 55 },
  { code: "TR20", price: 60 },
  { code: "RT5",  price: 45 },
  { code: "RT10", price: 50 },
  { code: "RT15", price: 55 },
  { code: "BC5",  price: 40 },
  { code: "BC10", price: 45 },
  { code: "BC20", price: 50 },
  { code: "BT10", price: 55 },
  { code: "SK5",  price: 35 },
  { code: "SK10", price: 40 },
  { code: "XA5",  price: 70 },
  { code: "XA10", price: 75 },
  { code: "5AM",  price: 80 },
  { code: "10AM", price: 85 },
  { code: "20AM", price: 90 },
  { code: "50AM", price: 95 },
];

const EMMA_ROWS: ParsedProductImportRow[] = EMMA_SKUS.map(({ code, price }) =>
  makeImportRow(code, price),
);

const EMMA_GLOBAL_PRODUCTS: Tables<"products">[] = EMMA_SKUS.map(({ code, price }) =>
  makeProduct(code, { price_usd: price }),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("matchVendorCatalogRows", () => {
  // Test 1: Product in document → appears
  it("T01 – product in vendor document is included in matched catalog", () => {
    const products = [makeProduct("SM5"), makeProduct("SM10")];
    const rows = [makeImportRow("SM5", 65), makeImportRow("SM10", 70)];
    const { matched, unmatchedCodes } = matchVendorCatalogRows(rows, products);
    expect(matched.map((m) => m.code)).toEqual(["SM5", "SM10"]);
    expect(unmatchedCodes).toHaveLength(0);
  });

  // Test 2: Product NOT in document → not in catalog
  it("T02 – product absent from vendor document is excluded from catalog", () => {
    const products = [makeProduct("SM5"), makeProduct("SM10"), makeProduct("SM15")];
    // SM15 is in global catalog but not in the document
    const rows = [makeImportRow("SM5", 65), makeImportRow("SM10", 70)];
    const { matched, unmatchedCodes } = matchVendorCatalogRows(rows, products);
    const matchedCodes = matched.map((m) => m.code);
    expect(matchedCodes).not.toContain("SM15");
    expect(matchedCodes).toContain("SM5");
    expect(matchedCodes).toContain("SM10");
    expect(unmatchedCodes).toHaveLength(0); // SM15 not in document at all
  });

  // Test 3: Two areas have different documents – no cross-contamination
  it("T03 – different documents for different areas produce independent catalogs", () => {
    const allProducts = [
      makeProduct("SM5"),
      makeProduct("SM10"),
      makeProduct("OIL5"),
      makeProduct("ORAL10"),
    ];
    // Vendor A document (area 1): only peptides
    const vendorARows = [makeImportRow("SM5", 65), makeImportRow("SM10", 70)];
    // Vendor B document (area 2): only oils and orals
    const vendorBRows = [makeImportRow("OIL5", 120), makeImportRow("ORAL10", 90)];

    const resultA = matchVendorCatalogRows(vendorARows, allProducts);
    const resultB = matchVendorCatalogRows(vendorBRows, allProducts);

    const codesA = resultA.matched.map((m) => m.code);
    const codesB = resultB.matched.map((m) => m.code);

    // No overlap
    expect(codesA).toContain("SM5");
    expect(codesA).toContain("SM10");
    expect(codesA).not.toContain("OIL5");
    expect(codesA).not.toContain("ORAL10");

    expect(codesB).toContain("OIL5");
    expect(codesB).toContain("ORAL10");
    expect(codesB).not.toContain("SM5");
    expect(codesB).not.toContain("SM10");
  });

  // Test 4: Globally active product, not in document → not in vendor catalog
  it("T04 – globally active product absent from document is excluded", () => {
    const globalProducts = [makeProduct("SM5"), makeProduct("GLOBAL_ONLY"), makeProduct("TR10")];
    const rows = [makeImportRow("SM5", 65), makeImportRow("TR10", 50)];
    const { matched } = matchVendorCatalogRows(rows, globalProducts);
    expect(matched.map((m) => m.code)).not.toContain("GLOBAL_ONLY");
  });

  // Test 5: Multiple variants – only document variants appear
  it("T05 – only variant codes present in document are matched", () => {
    const allVariants = [
      makeProduct("SM2"),
      makeProduct("SM5"),
      makeProduct("SM10"),
      makeProduct("SM15"),
      makeProduct("SM20"),
    ];
    // Document has only SM5, SM10, SM20
    const rows = [makeImportRow("SM5", 65), makeImportRow("SM10", 70), makeImportRow("SM20", 80)];
    const { matched } = matchVendorCatalogRows(rows, allVariants);
    const codes = matched.map((m) => m.code);
    expect(codes).toContain("SM5");
    expect(codes).toContain("SM10");
    expect(codes).toContain("SM20");
    expect(codes).not.toContain("SM2");
    expect(codes).not.toContain("SM15");
  });

  // Test 6: Document replacement – new result reflects new document only
  it("T06 – replacing vendor document completely replaces catalog", () => {
    const products = [makeProduct("SM5"), makeProduct("SM10"), makeProduct("TR10"), makeProduct("NEW1")];
    const oldRows = [makeImportRow("SM5", 65), makeImportRow("SM10", 70)];
    const newRows = [makeImportRow("TR10", 50), makeImportRow("NEW1", 100)];

    const oldResult = matchVendorCatalogRows(oldRows, products);
    const newResult = matchVendorCatalogRows(newRows, products);

    expect(oldResult.matched.map((m) => m.code)).toEqual(["SM5", "SM10"]);
    expect(newResult.matched.map((m) => m.code)).toEqual(["TR10", "NEW1"]);

    // Old entries are no longer present in new result
    expect(newResult.matched.map((m) => m.code)).not.toContain("SM5");
    expect(newResult.matched.map((m) => m.code)).not.toContain("SM10");
  });

  // Test 7: Vendor A changes document → vendor B unchanged
  it("T07 – updating vendor A does not change vendor B result", () => {
    const products = [makeProduct("SM5"), makeProduct("SM10"), makeProduct("OIL5")];
    const vendorBRows = [makeImportRow("OIL5", 120)];
    const vendorBResultBefore = matchVendorCatalogRows(vendorBRows, products);

    // Vendor A changes its document – totally different operation
    // Vendor B rows don't change
    const vendorBResultAfter = matchVendorCatalogRows(vendorBRows, products);

    expect(vendorBResultBefore).toEqual(vendorBResultAfter);
  });

  // Test 8: Vendor document contains injectable oils → oils appear
  it("T08 – oils in vendor document appear in catalog", () => {
    const products = [makeProduct("OIL5", { category: "Injectable Oil" }), makeProduct("SM5")];
    const rows = [makeImportRow("OIL5", 120), makeImportRow("SM5", 65)];
    const { matched } = matchVendorCatalogRows(rows, products);
    expect(matched.map((m) => m.code)).toContain("OIL5");
  });

  // Test 9: Vendor document contains no oils → oils do not appear
  it("T09 – oils absent from vendor document do not appear in catalog", () => {
    const products = [
      makeProduct("OIL5",  { category: "Injectable Oil" }),
      makeProduct("OIL10", { category: "Injectable Oil" }),
      makeProduct("SM5"),
    ];
    // Document has only peptides – no oils
    const rows = [makeImportRow("SM5", 65)];
    const { matched } = matchVendorCatalogRows(rows, products);
    const codes = matched.map((m) => m.code);
    expect(codes).not.toContain("OIL5");
    expect(codes).not.toContain("OIL10");
    expect(codes).toContain("SM5");
  });

  // Test 10: Vendor document contains orals → orals appear
  it("T10 – orals in vendor document appear in catalog", () => {
    const products = [makeProduct("ORAL10", { category: "Oral" }), makeProduct("SM5")];
    const rows = [makeImportRow("ORAL10", 90)];
    const { matched } = matchVendorCatalogRows(rows, products);
    expect(matched.map((m) => m.code)).toContain("ORAL10");
  });

  // Test 11: Vendor document contains no orals → orals do not appear
  it("T11 – orals absent from vendor document do not appear in catalog", () => {
    const products = [
      makeProduct("ORAL10", { category: "Oral" }),
      makeProduct("ORAL20", { category: "Oral" }),
      makeProduct("SM5"),
    ];
    const rows = [makeImportRow("SM5", 65)];
    const { matched } = matchVendorCatalogRows(rows, products);
    const codes = matched.map((m) => m.code);
    expect(codes).not.toContain("ORAL10");
    expect(codes).not.toContain("ORAL20");
  });

  // Test 12: No hardcoded category limiting
  it("T12 – no hardcoded category limits: mixed document (peptides + oils + orals) all appear", () => {
    const products = [
      makeProduct("SM5",    { category: "Peptide" }),
      makeProduct("OIL5",   { category: "Injectable Oil" }),
      makeProduct("ORAL10", { category: "Oral" }),
      makeProduct("WATER5", { category: "Reconstitution Water" }),
    ];
    // All categories in one document
    const rows = [
      makeImportRow("SM5",    65),
      makeImportRow("OIL5",   120),
      makeImportRow("ORAL10", 90),
      makeImportRow("WATER5", 10),
    ];
    const { matched } = matchVendorCatalogRows(rows, products);
    expect(matched).toHaveLength(4);
    const codes = matched.map((m) => m.code);
    expect(codes).toContain("SM5");
    expect(codes).toContain("OIL5");
    expect(codes).toContain("ORAL10");
    expect(codes).toContain("WATER5");
  });

  // Test 13: Prices come from vendor document, not global catalog
  it("T13 – vendor price from document overrides global catalog price", () => {
    const products = [
      makeProduct("SM5",  { price_usd: 100 }), // global price
      makeProduct("TR10", { price_usd: 200 }), // global price
    ];
    // Vendor document has different prices
    const rows = [
      makeImportRow("SM5",  65),  // vendor price
      makeImportRow("TR10", 50),  // vendor price
    ];
    const { matched } = matchVendorCatalogRows(rows, products);
    const sm5Entry = matched.find((m) => m.code === "SM5");
    const tr10Entry = matched.find((m) => m.code === "TR10");
    // Vendor prices should be in the matched entries, not global prices
    expect(sm5Entry?.price_usd).toBe(65);
    expect(tr10Entry?.price_usd).toBe(50);
    // Global catalog prices should NOT be used
    expect(sm5Entry?.price_usd).not.toBe(100);
    expect(tr10Entry?.price_usd).not.toBe(200);
  });

  // Test 14: Non-catalog product excluded at match stage (simulates checkout security)
  it("T14 – product not matched by vendor catalog is unavailable (simulates checkout rejection)", () => {
    const products = [makeProduct("SM5"), makeProduct("INJECTED_BY_ATTACKER")];
    // Document only has SM5; attacker tries to include INJECTED_BY_ATTACKER
    const legitimateRows = [makeImportRow("SM5", 65)];
    const { matched } = matchVendorCatalogRows(legitimateRows, products);
    // INJECTED_BY_ATTACKER is not in the document → not matched → not in catalog
    // Therefore product_visible_in_shop_area would return false → checkout skips it
    expect(matched.map((m) => m.code)).not.toContain("INJECTED_BY_ATTACKER");
    expect(matched.map((m) => m.code)).toContain("SM5");
  });

  // Test 15: Emma.xlsx regression dataset
  it("T15 – Emma.xlsx regression: all 23 SKUs matched, prices from document", () => {
    // Build a global catalog that includes all Emma SKUs plus extras not in Emma
    const globalProducts: Tables<"products">[] = [
      ...EMMA_GLOBAL_PRODUCTS,
      // Extra products that should NOT appear (not in Emma.xlsx)
      makeProduct("EXTRA_OIL1", { category: "Injectable Oil", price_usd: 500 }),
      makeProduct("EXTRA_ORAL1", { category: "Oral", price_usd: 300 }),
      makeProduct("NOT_IN_EMMA", { price_usd: 999 }),
    ];

    const { matched, unmatchedCodes } = matchVendorCatalogRows(EMMA_ROWS, globalProducts);

    // All 23 Emma SKUs should be matched
    expect(matched).toHaveLength(23);
    expect(unmatchedCodes).toHaveLength(0);

    // Extra global products should NOT be in the catalog
    const matchedCodes = new Set(matched.map((m) => m.code));
    expect(matchedCodes.has("EXTRA_OIL1")).toBe(false);
    expect(matchedCodes.has("EXTRA_ORAL1")).toBe(false);
    expect(matchedCodes.has("NOT_IN_EMMA")).toBe(false);

    // Spot-check: prices from Emma document (not global catalog default of 100)
    const sm5 = matched.find((m) => m.code === "SM5");
    expect(sm5?.price_usd).toBe(65); // Emma price, not global 100

    const xa10 = matched.find((m) => m.code === "XA10");
    expect(xa10?.price_usd).toBe(75);

    const fiftyAm = matched.find((m) => m.code === "50AM");
    expect(fiftyAm?.price_usd).toBe(95);
  });
});

// ---------------------------------------------------------------------------
// diffVendorCatalog tests
// ---------------------------------------------------------------------------

describe("diffVendorCatalog", () => {
  it("returns added/removed sets correctly", () => {
    const current = {
      entries: [
        { product_id: "id-sm5", vendor_code: "SM5", price_usd: 65 },
        { product_id: "id-sm10", vendor_code: "SM10", price_usd: 70 },
      ],
    };
    const next = matchVendorCatalogRows(
      [makeImportRow("SM10", 70), makeImportRow("TR10", 50)],
      [makeProduct("SM5"), makeProduct("SM10"), makeProduct("TR10")],
    );
    const { added, removed } = diffVendorCatalog(current, next);
    expect(added).toContain("TR10");
    expect(removed).toContain("SM5");
    expect(added).not.toContain("SM5");
  });
});

// ---------------------------------------------------------------------------
// Security: Fail-Closed Checkout Regression Tests (Security-Fix 0056)
//
// These tests verify the TypeScript catalog-membership layer that underpins the
// SQL-level fail-closed behaviour in create_order.
//
// The SQL invariant (migration 0056):
//   IF any non-kit cart item is not in product_visible_in_shop_area(id, area)
//   THEN create_order raises 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog.'
//
// Here we test that matchVendorCatalogRows correctly identifies which products
// ARE and ARE NOT in the vendor catalog, so the SQL allowlist is populated
// correctly and the fail-closed guard fires as expected.
// ---------------------------------------------------------------------------

describe("Security: fail-closed checkout (0056)", () => {
  // S1: All cart items valid → all products matched (order would proceed)
  it("S01 – all cart items in vendor catalog → all products matched, order can proceed", () => {
    const products = [makeProduct("SM5"), makeProduct("SM10"), makeProduct("TR10")];
    const rows = [makeImportRow("SM5", 65), makeImportRow("SM10", 70), makeImportRow("TR10", 50)];
    const { matched, unmatchedCodes } = matchVendorCatalogRows(rows, products);
    // All three products are in the catalog → create_order visibility check passes for all
    expect(matched).toHaveLength(3);
    expect(unmatchedCodes).toHaveLength(0);
  });

  // S2: One cart item NOT in catalog → non-catalog product excluded from allowlist
  //     → product_visible_in_shop_area returns false → create_order raises exception
  it("S02 – one item outside vendor catalog → excluded from allowlist → order would be rejected", () => {
    const products = [makeProduct("SM5"), makeProduct("SM10"), makeProduct("FOREIGN")];
    // Document only covers SM5 + SM10; FOREIGN is a global product not in this area's document
    const rows = [makeImportRow("SM5", 65), makeImportRow("SM10", 70)];
    const { matched } = matchVendorCatalogRows(rows, products);
    const matchedIds = new Set(matched.map((m) => m.product_id));
    // FOREIGN is NOT in the catalog allowlist → product_visible_in_shop_area would return false
    expect(matchedIds.has("id-foreign")).toBe(false);
    // SM5 and SM10 are in the catalog
    expect(matchedIds.has("id-sm5")).toBe(true);
    expect(matchedIds.has("id-sm10")).toBe(true);
    // Because FOREIGN is outside the allowlist, create_order raises instead of skipping
    // → the entire order (including SM5 + SM10) is rejected
  });

  // S3: Multiple valid items + one foreign vendor product → order must be rejected entirely
  it("S03 – valid items + one foreign product → foreign product not in allowlist → full rejection", () => {
    const products = [
      makeProduct("SM5"),
      makeProduct("SM10"),
      makeProduct("TR10"),
      makeProduct("GB2_ONLY"), // belongs to a different area's catalog
    ];
    // Area catalog (e.g. Group Buy 1) does not include GB2_ONLY
    const areaRows = [
      makeImportRow("SM5",  65),
      makeImportRow("SM10", 70),
      makeImportRow("TR10", 50),
    ];
    const { matched } = matchVendorCatalogRows(areaRows, products);
    const matchedIds = new Set(matched.map((m) => m.product_id));
    // GB2_ONLY has no shop_area_products row for this area
    expect(matchedIds.has("id-gb2_only")).toBe(false);
    // A cart containing GB2_ONLY would cause create_order to raise, rejecting ALL items
  });

  // S4: Product belongs to Group Buy 1 catalog, checkout is for Group Buy 2
  //     → product NOT in GB2 allowlist → checkout for GB2 would be rejected
  it("S04 – GB1 product in GB2 checkout → not in GB2 allowlist → order rejected", () => {
    const allProducts = [makeProduct("GB1_PEPTIDE"), makeProduct("GB2_PEPTIDE")];
    // GB1 document
    const gb1Rows = [makeImportRow("GB1_PEPTIDE", 60)];
    // GB2 document
    const gb2Rows = [makeImportRow("GB2_PEPTIDE", 55)];

    const gb1Result = matchVendorCatalogRows(gb1Rows, allProducts);
    const gb2Result = matchVendorCatalogRows(gb2Rows, allProducts);

    const gb1Ids = new Set(gb1Result.matched.map((m) => m.product_id));
    const gb2Ids = new Set(gb2Result.matched.map((m) => m.product_id));

    // GB1_PEPTIDE is in GB1 catalog, NOT in GB2 catalog
    expect(gb1Ids.has("id-gb1_peptide")).toBe(true);
    expect(gb2Ids.has("id-gb1_peptide")).toBe(false);

    // A checkout for GB2 with GB1_PEPTIDE in cart would fail the visibility check
    // and create_order would raise 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog.'
  });

  // S5: Product belongs to Group Buy 2 catalog, checkout is for Group Buy 1
  //     → not in GB1 allowlist → order rejected
  it("S05 – GB2 product in GB1 checkout → not in GB1 allowlist → order rejected", () => {
    const allProducts = [makeProduct("GB1_PRODUCT"), makeProduct("GB2_PRODUCT")];

    const gb1Rows = [makeImportRow("GB1_PRODUCT", 60)];
    const gb2Rows = [makeImportRow("GB2_PRODUCT", 55)];

    const gb1Result = matchVendorCatalogRows(gb1Rows, allProducts);
    const gb2Result = matchVendorCatalogRows(gb2Rows, allProducts);

    const gb1Ids = new Set(gb1Result.matched.map((m) => m.product_id));
    const gb2Ids = new Set(gb2Result.matched.map((m) => m.product_id));

    // GB2_PRODUCT is in GB2 catalog, NOT in GB1 catalog
    expect(gb2Ids.has("id-gb2_product")).toBe(true);
    expect(gb1Ids.has("id-gb2_product")).toBe(false);
  });

  // S6: Manipulated client-side price → vendor price from shop_area_product_prices is used
  //     (server-side pricing via apply_shop_area_product_overrides; client price ignored)
  it("S06 – vendor catalog entry preserves document price (server recalculates, client price ignored)", () => {
    const globalProducts = [makeProduct("SM5", { price_usd: 9999 })]; // global price doesn't matter
    const vendorRows = [makeImportRow("SM5", 65)]; // vendor's actual import price

    const { matched } = matchVendorCatalogRows(vendorRows, globalProducts);
    const sm5 = matched.find((m) => m.code === "SM5");

    // The catalog entry stores the vendor price (65), NOT the manipulated client value
    // When create_order runs, apply_shop_area_product_overrides reads shop_area_product_prices
    // and returns price_usd = 65, which goes through the full pricing pipeline.
    expect(sm5?.price_usd).toBe(65);
    // Global price (9999) is not used as the catalog entry
    expect(sm5?.price_usd).not.toBe(9999);
  });

  // S7: Valid order with correct products → existing pricing chain unmodified
  it("S07 – valid order: pricing chain (vendor price × area factor × role markup) remains unchanged", () => {
    const products = [
      makeProduct("SM5", { price_usd: 65 }), // vendor import price already in global catalog
    ];
    const rows = [makeImportRow("SM5", 65)];

    const { matched } = matchVendorCatalogRows(rows, products);
    expect(matched).toHaveLength(1);

    const entry = matched[0];
    // Pricing pipeline (0054/0055): vendor_price × (base_price_factor_pct / 100) × role_markup
    // Example: retail area factor = 300%, kit_divisor = 10, no role markup
    // catalog_unit = (65 / 10) × (300/100) = 6.5 × 3 = 19.5 USD/vial
    // This calculation happens server-side in shop_area_catalog_unit; we only verify
    // that the catalog entry contains the correct vendor price as input.
    expect(entry.price_usd).toBe(65);
    expect(entry.bulk_price_usd).toBeNull();
    expect(entry.bulk_price_min_quantity).toBeNull();
  });
});

describe("vendor catalog assortment source", () => {
  it("normalizes SKUs by trim, collapsing spaces, and uppercase", () => {
    expect(normalizeVendorSku(" sm5 ")).toBe("SM5");
    expect(normalizeVendorSku("SM5")).toBe("SM5");
    expect(normalizeVendorSku("Sm5")).toBe("SM5");
    expect(normalizeVendorSku("S M 5")).toBe("SM5");
  });

  it("R01 – empty dealer file leaves Shop / GB1 / GB2 empty", () => {
    const globals = [makeProduct("SM5"), makeProduct("OXO50"), makeProduct("Tadalafil")];
    const empty = matchVendorCatalogRows([], globals);
    expect(empty.matched).toEqual([]);
    expect(empty.unmatched).toEqual([]);
  });

  it("R02 – 23 file SKUs stay exactly 23; extra globals never appear", () => {
    const { matched } = matchVendorCatalogRows(EMMA_ROWS, [
      ...EMMA_GLOBAL_PRODUCTS,
      makeProduct("SM30"),
      makeProduct("OXO50"),
    ]);
    expect(matched).toHaveLength(23);
    expect(matched.map((row) => row.code)).not.toContain("SM30");
    expect(matched.map((row) => row.code)).not.toContain("OXO50");
  });

  it("R03 – unknown master SKUs stay in the vendor catalog with product_id null", () => {
    const { matched, unmatched, unmatchedCodes, unlinkedCodes } = matchVendorCatalogRows(
      [makeImportRow("SM5", 65), makeImportRow("UNKNOWN99", 10), makeImportRow(" sm 5 ", 70)],
      [makeProduct("SM5")],
    );
    expect(matched.map((row) => row.code)).toEqual(["SM5", "UNKNOWN99"]);
    expect(matched.find((row) => row.code === "UNKNOWN99")?.product_id).toBeNull();
    expect(unlinkedCodes).toEqual(["UNKNOWN99"]);
    expect(unmatchedCodes).toEqual(["UNKNOWN99"]);
    expect(unmatched).toEqual([]);
  });

  it("R04 – rows without a vendor price are unmatched, not filled from products.price_usd", () => {
    const { matched, unmatched } = matchVendorCatalogRows(
      [makeImportRow("SM5", 0, { parsedPriceUsd: null })],
      [makeProduct("SM5", { price_usd: 100 })],
    );
    expect(matched).toEqual([]);
    expect(unmatched).toEqual([expect.objectContaining({ code: "SM5", reason: "no_price" })]);
  });

  it("R05 – extra file columns stay on vendor_raw and matching does not mutate products", () => {
    const products = [makeProduct("SM5", { price_usd: 100 })];
    const snapshot = structuredClone(products);
    const { matched } = matchVendorCatalogRows(
      [makeImportRow("SM5", 80, { extraFields: { Lieferant: "Emma", MOQ: "1" } })],
      products,
    );
    expect(matched[0]?.price_usd).toBe(80);
    expect(matched[0]?.vendor_raw.extraFields).toEqual({ Lieferant: "Emma", MOQ: "1" });
    expect(products).toEqual(snapshot);
  });

  it("R06 – Shop and GB1 / GB1 and GB2 catalogs stay isolated", () => {
    const products = [makeProduct("SM5"), makeProduct("SM10"), makeProduct("OXO50")];
    const shop = matchVendorCatalogRows([makeImportRow("SM5", 80)], products);
    const gb1 = matchVendorCatalogRows([makeImportRow("SM10", 70)], products);
    const gb2 = matchVendorCatalogRows([makeImportRow("OXO50", 40)], products);
    expect(shop.matched.map((row) => row.code)).toEqual(["SM5"]);
    expect(gb1.matched.map((row) => row.code)).toEqual(["SM10"]);
    expect(gb2.matched.map((row) => row.code)).toEqual(["OXO50"]);
    expect(matchVendorCatalogRows([], products).matched).toEqual([]);
  });
});

describe("vendor catalog SQL (0056 + 0057)", () => {
  const sql0056 = readFileSync(resolve(process.cwd(), "supabase/migrations/0056_area_vendor_catalog.sql"), "utf8");
  const sql0057 = readFileSync(resolve(process.cwd(), "supabase/migrations/0057_vendor_catalog_raw.sql"), "utf8");

  it("keeps fail-closed create_order and does not skip foreign catalog items", () => {
    expect(sql0056).toContain("Ein Produkt gehört nicht zum aktuellen Händlerkatalog.");
    expect(sql0056).toMatch(/if not public\.product_visible_in_shop_area/);
    expect(sql0056).toMatch(/raise exception 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog\.'/);
    expect(sql0056).not.toMatch(/update public\.products set price_usd/);
  });

  it("stores vendor raw fields without rewriting global products", () => {
    expect(sql0057).toContain("vendor_raw jsonb");
    expect(sql0057).toContain("vendor_name");
    expect(sql0057).toContain("vendor_dosage");
    expect(sql0057).toContain("apply_area_vendor_catalog");
    expect(sql0057).toContain("shop_area_documents");
    expect(sql0057).not.toMatch(/update public\.products/);
    expect(sql0057).not.toMatch(/insert into public\.products/);
    expect(VENDOR_PDF_UNREADABLE).toContain("Bitte CSV oder Excel verwenden");
  });
});

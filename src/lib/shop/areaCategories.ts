/**
 * Per-area display categories. Assortment stays the vendor catalog; this module
 * only decides where a catalog product is shown. Never reads products.category
 * as the storefront grouping source.
 */

export interface AreaCategory {
  category_key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface AreaCategoryAssignment {
  product_id: string;
  vendor_code?: string;
  category_key: string;
}

export interface ShopAreaStorefront {
  categories: AreaCategory[];
  assignments: AreaCategoryAssignment[];
}

export type AreaCategorySource = "manual" | "vendor_file" | "none";

/** Seed keys created by migration 0059. Architecture is not limited to these. */
export const DEFAULT_AREA_CATEGORY_KEYS = [
  "peptides",
  "injectable-oils",
  "orals",
  "reconstitution-water",
] as const;

const FILE_ALIASES: Record<string, readonly string[]> = {
  peptides: ["peptides", "peptide", "präparate", "preparate"],
  "injectable-oils": [
    "injectable-oils",
    "injectable oils",
    "injectables-oils",
    "injectables",
    "oils",
    "oil",
  ],
  orals: ["orals", "oral"],
  "reconstitution-water": [
    "reconstitution-water",
    "reconstitution water",
    "water",
    "bac water",
  ],
};

function normalizeCategoryToken(value: string): string {
  return value.trim().toLowerCase().replace(/[_]+/g, "-").replace(/\s+/g, " ");
}

export function effectiveAreaCategoryKey(
  importedCategoryKey: string | null | undefined,
  manualCategoryKey: string | null | undefined,
): string | null {
  const manual = manualCategoryKey?.trim() || null;
  if (manual) return manual;
  const imported = importedCategoryKey?.trim() || null;
  return imported;
}

export interface AreaCatalogCategoryRow {
  product_id: string;
  shop_area_key: string;
  imported_category_key: string | null;
  manual_category_key: string | null;
}

export interface AreaCategoryActiveRow {
  shop_area_key: string;
  category_key: string;
  is_active: boolean;
}

/**
 * Mirrors SQL `kit_request_matches_area_category`.
 * Category filters use the area assignment only — never `products.category`.
 */
export function kitRequestMatchesAreaCategory(input: {
  productId: string;
  shopArea: string;
  filterCategory: string | null | undefined;
  catalogRows: readonly AreaCatalogCategoryRow[];
  areaCategories: readonly AreaCategoryActiveRow[];
}): boolean {
  if (!input.filterCategory) return true;
  const row = input.catalogRows.find(
    (entry) => entry.product_id === input.productId && entry.shop_area_key === input.shopArea,
  );
  if (!row) return false;
  const effective = effectiveAreaCategoryKey(row.imported_category_key, row.manual_category_key);
  if (!effective || effective !== input.filterCategory) return false;
  return input.areaCategories.some(
    (category) =>
      category.shop_area_key === input.shopArea &&
      category.category_key === effective &&
      category.is_active,
  );
}

export function areaCategorySource(
  importedCategoryKey: string | null | undefined,
  manualCategoryKey: string | null | undefined,
): AreaCategorySource {
  if (manualCategoryKey?.trim()) return "manual";
  if (importedCategoryKey?.trim()) return "vendor_file";
  return "none";
}

/**
 * Maps a dealer-file category string onto an area category key.
 * Returns null when the value is missing or not uniquely recognized.
 * Does not fall back to peptides.
 */
export function parseImportedCategoryKey(
  raw: string | null | undefined,
  categories: readonly Pick<AreaCategory, "category_key" | "label">[],
): string | null {
  const token = normalizeCategoryToken(raw ?? "");
  if (!token) return null;

  const matches = new Set<string>();
  for (const category of categories) {
    const keyNorm = normalizeCategoryToken(category.category_key);
    const labelNorm = normalizeCategoryToken(category.label);
    if (token === keyNorm || token === labelNorm) {
      matches.add(category.category_key);
      continue;
    }
    const aliases = FILE_ALIASES[category.category_key] ?? [];
    if (aliases.some((alias) => normalizeCategoryToken(alias) === token)) {
      matches.add(category.category_key);
    }
  }

  if (matches.size !== 1) return null;
  return [...matches][0] ?? null;
}

export function assignmentMap(
  assignments: readonly AreaCategoryAssignment[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of assignments) {
    map.set(row.product_id, row.category_key);
    if (row.vendor_code) map.set(row.vendor_code, row.category_key);
  }
  return map;
}

export function productsInAreaCategory<T extends { id: string; code?: string }>(
  products: readonly T[],
  assignments: readonly AreaCategoryAssignment[],
  categoryKey: string,
): T[] {
  const byKey = assignmentMap(assignments);
  return products.filter((product) => {
    const assigned = byKey.get(product.id) ?? (product.code ? byKey.get(product.code) : undefined);
    return assigned === categoryKey;
  });
}

export function countProductsByAreaCategory(
  productIds: readonly string[],
  assignments: readonly AreaCategoryAssignment[],
): Record<string, number> {
  const byId = assignmentMap(assignments);
  const counts: Record<string, number> = {};
  for (const id of productIds) {
    const key = byId.get(id);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Active categories that currently contain at least one catalog product.
 * Empty or inactive categories are omitted from the storefront.
 */
export function visibleStorefrontCategories(
  categories: readonly AreaCategory[],
  assignments: readonly AreaCategoryAssignment[],
  catalogProductIds: readonly string[],
): AreaCategory[] {
  const counts = countProductsByAreaCategory(catalogProductIds, assignments);
  return [...categories]
    .filter((category) => category.is_active && (counts[category.category_key] ?? 0) > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "de"));
}

export function storefrontHeadline(label: string): string {
  return label.trim().toUpperCase();
}

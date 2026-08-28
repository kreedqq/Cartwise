export const SHOP_CATEGORY_IDS = ["peptides", "injectable-oils", "orals", "reconstitution-water"] as const;
export type ShopCategoryId = (typeof SHOP_CATEGORY_IDS)[number];

export interface ShopCategory {
  id: ShopCategoryId;
  label: string;
  headline: string;
  description: string;
  storedValues: string[];
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  {
    id: "peptides",
    label: "Peptides",
    headline: "PEPTIDES",
    description: "Peptide-Katalog",
    storedValues: ["PEPTIDES", "Peptides", "Peptide"],
  },
  {
    id: "injectable-oils",
    label: "Injectable Oils",
    headline: "INJECTABLE OILS",
    description: "Öle und Injektabilia",
    storedValues: ["INJECTABLES-OILS", "INJECTABLE OILS", "INJECTABLE-OILS", "Injectable Oils"],
  },
  {
    id: "orals",
    label: "Orals",
    headline: "ORALS",
    description: "Orale Präparate",
    storedValues: ["ORALS", "Orals", "Oral"],
  },
  {
    id: "reconstitution-water",
    label: "Reconstitution Water",
    headline: "RECONSTITUTION WATER",
    description: "BAC Water und AA Water",
    storedValues: ["RECONSTITUTION-WATER", "RECONSTITUTION WATER", "Reconstitution Water"],
  },
] as const;

const RECONSTITUTION_CODES = new Set(["AA10", "BA03", "BA10"]);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_]+/g, "-").replace(/\s+/g, " ");
}

export function isShopCategoryId(value: string | null | undefined): value is ShopCategoryId {
  return SHOP_CATEGORY_IDS.includes(value as ShopCategoryId);
}

export function shopCategoryById(id: ShopCategoryId): ShopCategory {
  return SHOP_CATEGORIES.find((c) => c.id === id) ?? SHOP_CATEGORIES[0];
}

export function isReconstitutionWaterProduct(product: {
  category?: string | null;
  name?: string | null;
  code?: string | null;
}): boolean {
  const name = normalize(product.name ?? "");
  if (name === "bac water" || name === "aa water") return true;
  const code = (product.code ?? "").trim().toUpperCase();
  if (RECONSTITUTION_CODES.has(code)) return true;
  const stored = normalize(product.category ?? "");
  return stored.includes("reconstitution");
}

/**
 * Maps catalog `products.category` (and BAC/AA Water by name/code) onto the four
 * shop storefront groups. Unknown rows fall back to Peptides so nothing is hidden.
 */
export function shopCategoryIdFor(product: {
  category?: string | null;
  name?: string | null;
  code?: string | null;
}): ShopCategoryId {
  if (isReconstitutionWaterProduct(product)) return "reconstitution-water";

  const stored = product.category?.trim() ?? "";
  if (stored) {
    const key = normalize(stored);
    for (const category of SHOP_CATEGORIES) {
      if (category.storedValues.some((value) => normalize(value) === key)) return category.id;
    }
    if (key.includes("oral")) return "orals";
    if (key.includes("oil") || key.includes("inject")) return "injectable-oils";
    if (key.includes("peptide")) return "peptides";
  }

  const haystack = `${product.name ?? ""} ${product.code ?? ""}`.toLowerCase();
  if (/\boral/.test(haystack)) return "orals";
  if (/\boil\b|\binject/.test(haystack)) return "injectable-oils";
  return "peptides";
}

export function productInShopCategory(
  product: { category?: string | null; name?: string | null; code?: string | null },
  categoryId: ShopCategoryId,
): boolean {
  return shopCategoryIdFor(product) === categoryId;
}

export function countProductsByShopCategory<
  T extends { category?: string | null; name?: string | null; code?: string | null },
>(products: T[]): Record<ShopCategoryId, number> {
  const counts: Record<ShopCategoryId, number> = {
    peptides: 0,
    "injectable-oils": 0,
    orals: 0,
    "reconstitution-water": 0,
  };
  for (const product of products) {
    counts[shopCategoryIdFor(product)] += 1;
  }
  return counts;
}

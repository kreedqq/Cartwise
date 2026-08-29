import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import { coverageStatusForProduct } from "@/lib/peptide/shopCoverage/coverage";
import {
  catalogNamesForSlug,
  familySlugForCatalogName,
  normalizeCatalogName,
} from "@/lib/peptide/shopCoverage/names";
import { substanceLabelForSlug } from "@/lib/peptide/shopCoverage/formClass";
import type { ShopCatalogProduct } from "@/lib/peptide/shopCoverage/types";
import { variantStrengthLabel } from "@/lib/shop/variantCoverage";
import type { Tables } from "@/types/database";

/** Common cart quantities supported by existing validation (1–10). */
export const SHOP_QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const STRENGTH_SUFFIX =
  /\s+\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|iu|ml|ui)\b\s*$/i;

/** Slugs where a trailing mg value is part of the product identity, not just vial strength. */
const IDENTITY_STRENGTH_SLUGS = new Set([
  "tritren-225",
  "mast-blend",
  "blend-opaque",
  "sustanon",
  "supertest",
  "trenmix",
  "testosterone-600",
  "testosterone-suspension",
]);

function stripTrailingStrength(name: string): string {
  let result = name.trim();
  while (STRENGTH_SUFFIX.test(result)) {
    result = result.replace(STRENGTH_SUFFIX, "").trim();
  }
  return result || name.trim();
}

/**
 * Public shop list label: removes vial strength where safe, keeps product identity intact.
 * Does not mutate underlying product data.
 */
export function normalizeShopDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const parenMatch = /^\(([A-Za-z]+)\)/.exec(trimmed);
  if (parenMatch) return parenMatch[1].toUpperCase();

  const slug = familySlugForCatalogName(trimmed);
  const catalogNames = catalogNamesForSlug(slug);

  if (catalogNames.length > 0) {
    const canonical = substanceLabelForSlug(slug, trimmed);
    if (IDENTITY_STRENGTH_SLUGS.has(slug)) {
      if (slug === "blend-opaque") return stripTrailingStrength(canonical);
      return canonical.replace(/\s*mg\b\s*$/i, "").trim() || canonical;
    }
    return stripTrailingStrength(canonical);
  }

  return stripTrailingStrength(trimmed);
}

export function shopDisplaySortKey(name: string): string {
  return normalizeShopDisplayName(name).toLocaleLowerCase("de");
}

function toCatalogProduct(product: Pick<Tables<"products">, "code" | "name">): ShopCatalogProduct {
  return {
    code: product.code,
    name: product.name,
    category: null,
    variantLabel: null,
    isActive: true,
  };
}

export function lexiconHrefForShopProduct(product: Pick<Tables<"products">, "code" | "name">): string | null {
  const catalogProduct = toCatalogProduct(product);
  const status = coverageStatusForProduct(catalogProduct);
  const slug = status.familySlug;
  if (!slug) return null;
  if (status.status === "REVIEW_REQUIRED" || status.status === "UNKNOWN" || status.status === "NON_LEXICON") {
    return null;
  }
  if (!buildPublicLexiconV2Catalog().bySlug.has(slug)) return null;
  return `/peptide/lexikon/${slug}`;
}

export function variantLabelForProduct(
  product: Pick<Tables<"products">, "code" | "name" | "dosage_vial">,
): string {
  return variantStrengthLabel(product);
}

function variantSortKey(label: string): number {
  const match = /(\d+(?:[.,]\d+)?)/.exec(label);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export interface ShopProductGroup {
  displayName: string;
  sortKey: string;
  familySlug: string;
  lexiconHref: string | null;
  variants: Tables<"products">[];
}

export function groupAndSortShopProducts(products: readonly Tables<"products">[]): ShopProductGroup[] {
  const byFamily = new Map<string, Tables<"products">[]>();

  for (const product of products) {
    const slug = familySlugForCatalogName(product.name);
    const list = byFamily.get(slug) ?? [];
    list.push(product);
    byFamily.set(slug, list);
  }

  const groups: ShopProductGroup[] = [];

  for (const [familySlug, variants] of byFamily) {
    const sortedVariants = [...variants].sort((a, b) => {
      const labelDiff =
        variantSortKey(variantLabelForProduct(a)) - variantSortKey(variantLabelForProduct(b));
      if (labelDiff !== 0) return labelDiff;
      return a.code.localeCompare(b.code, "en", { numeric: true });
    });

    const primary = sortedVariants[0];
    const displayName = normalizeShopDisplayName(primary.name);
    groups.push({
      displayName,
      sortKey: displayName.toLocaleLowerCase("de"),
      familySlug,
      lexiconHref: lexiconHrefForShopProduct(primary),
      variants: sortedVariants,
    });
  }

  groups.sort((a, b) => {
    const byName = a.sortKey.localeCompare(b.sortKey, "de", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.familySlug.localeCompare(b.familySlug, "en");
  });

  return groups;
}

export function productMatchesShopSearch(
  product: Pick<Tables<"products">, "code" | "name">,
  term: string,
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const display = normalizeShopDisplayName(product.name).toLowerCase();
  return (
    product.code.toLowerCase().includes(needle) ||
    product.name.toLowerCase().includes(needle) ||
    display.includes(needle) ||
    normalizeCatalogName(product.name).includes(needle)
  );
}

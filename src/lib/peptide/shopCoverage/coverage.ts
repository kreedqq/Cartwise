import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { UNMAP_PREFIX_CODES, UNRESOLVED_PRODUCT_MAPPINGS } from "@/lib/peptide/persistence/explicitProductMappings";
import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import { postgresMappingSlug } from "@/lib/peptide/persistence/sqlProductMapping";
import { parseStrengthLabel } from "@/lib/peptide/search";
import {
  coverageCategoryForName,
  isExactCatalogName,
  isOpaqueCatalogName,
  isReconstitutionWaterName,
  substanceLabelForSlug,
} from "@/lib/peptide/shopCoverage/formClass";
import { familySlugForCatalogName } from "@/lib/peptide/shopCoverage/names";
import { loadShopCatalogProducts } from "@/lib/peptide/shopCoverage/loadProducts";
import type { CoverageStatus, ShopCatalogProduct, ShopCoverageRow } from "@/lib/peptide/shopCoverage/types";

const COMPLETE_RESEARCH_SLUGS = new Set(PEPTIDE_SUBSTANCES_IDENTITY.map((item) => item.slug));

const UNRESOLVED_CODES = new Set([
  ...UNRESOLVED_PRODUCT_MAPPINGS.map((row) => row.code.toUpperCase()),
  ...UNMAP_PREFIX_CODES.map((code) => code.toUpperCase()),
]);

export function coverageStatusForProduct(product: ShopCatalogProduct): Pick<
  ShopCoverageRow,
  "status" | "familySlug" | "researchSlug" | "reason" | "lexiconProfileRequired" | "mappingUnique"
> {
  const code = product.code.trim().toUpperCase();
  const familySlug = familySlugForCatalogName(product.name);
  const researchSlug = postgresMappingSlug(product);
  const exactName = isExactCatalogName(product.name);
  const mappingUnique: "ja" | "nein" =
    exactName && !UNRESOLVED_CODES.has(code) && !isOpaqueCatalogName(product.name) ? "ja" : "nein";

  if (isReconstitutionWaterName(product.name)) {
    return {
      status: "NON_LEXICON",
      familySlug,
      researchSlug: null,
      reason: "Rekonstitutionsflüssigkeit (BAC/AA Water), kein Wirkstoffprofil.",
      lexiconProfileRequired: "nein",
      mappingUnique: "ja",
    };
  }

  if (UNRESOLVED_CODES.has(code)) {
    const unresolved = UNRESOLVED_PRODUCT_MAPPINGS.find((row) => row.code.toUpperCase() === code);
    return {
      status: "REVIEW_REQUIRED",
      familySlug,
      researchSlug: null,
      reason: unresolved?.reason ?? "Identität nicht sicher zuordenbar.",
      lexiconProfileRequired: "ja",
      mappingUnique: "nein",
    };
  }

  if (isOpaqueCatalogName(product.name)) {
    return {
      status: "UNKNOWN",
      familySlug,
      researchSlug: null,
      reason: "Shopbezeichnung ohne identifizierbaren Wirkstoff.",
      lexiconProfileRequired: "nein",
      mappingUnique: "nein",
    };
  }

  if (researchSlug && COMPLETE_RESEARCH_SLUGS.has(researchSlug)) {
    return {
      status: "COMPLETE",
      familySlug: researchSlug,
      researchSlug,
      reason: "Sicher der vorhandenen Research-Identität zugeordnet.",
      lexiconProfileRequired: "ja",
      mappingUnique,
    };
  }

  return {
    status: "PARTIAL",
    familySlug,
    researchSlug: null,
    reason: "Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil.",
    lexiconProfileRequired: "ja",
    mappingUnique,
  };
}

export function coverageRowForProduct(product: ShopCatalogProduct): ShopCoverageRow {
  const familySlug = familySlugForCatalogName(product.name);
  const statusFields = coverageStatusForProduct(product);
  const variant =
    product.variantLabel?.trim() ||
    parseStrengthLabel(product.name) ||
    product.name.match(/(\d+(?:[.,]\d+)?\s*(?:mg|mcg|iu|ml|ui))/i)?.[1]?.replace(",", ".") ||
    "—";

  return {
    code: product.code,
    name: product.name,
    shopCategory: product.category,
    coverageCategory: coverageCategoryForName(product.name),
    substance: substanceLabelForSlug(statusFields.familySlug ?? familySlug, product.name),
    familySlug: statusFields.familySlug,
    researchSlug: statusFields.researchSlug,
    variant,
    lexiconProfileRequired: statusFields.lexiconProfileRequired,
    mappingUnique: statusFields.mappingUnique,
    status: statusFields.status,
    reason: statusFields.reason,
  };
}

export function shopCoverageMatrix(products: readonly ShopCatalogProduct[] = loadShopCatalogProducts()): ShopCoverageRow[] {
  return products.map(coverageRowForProduct);
}

export interface CoverageReportSummary {
  shopProductsTotal: number;
  uniquelyMapped: number;
  multiVariantProducts: number;
  multiVariantFamilies: number;
  newLexiconProfilesRequired: number;
  reviewRequired: number;
  unknown: number;
  nonLexicon: number;
  complete: number;
  partial: number;
  categoryCounts: Record<string, number>;
  statusCounts: Record<CoverageStatus, number>;
  ambiguousProducts: ShopCoverageRow[];
}

export function coverageReportSummary(rows: readonly ShopCoverageRow[] = shopCoverageMatrix()): CoverageReportSummary {
  const familyCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.familySlug) continue;
    familyCounts.set(row.familySlug, (familyCounts.get(row.familySlug) ?? 0) + 1);
  }

  const profileFamilies = new Set<string>();
  for (const row of rows) {
    if (row.status === "NON_LEXICON" || !row.familySlug) continue;
    if (row.status === "PARTIAL" || row.status === "REVIEW_REQUIRED" || row.status === "UNKNOWN") {
      profileFamilies.add(row.familySlug);
    }
  }

  const categoryCounts: Record<string, number> = {};
  const statusCounts: Record<CoverageStatus, number> = {
    COMPLETE: 0,
    PARTIAL: 0,
    REVIEW_REQUIRED: 0,
    NON_LEXICON: 0,
    UNKNOWN: 0,
  };

  for (const row of rows) {
    categoryCounts[row.coverageCategory] = (categoryCounts[row.coverageCategory] ?? 0) + 1;
    statusCounts[row.status] += 1;
  }

  return {
    shopProductsTotal: rows.length,
    uniquelyMapped: rows.filter((row) => row.mappingUnique === "ja").length,
    multiVariantProducts: rows.filter((row) => row.familySlug && (familyCounts.get(row.familySlug) ?? 0) > 1).length,
    multiVariantFamilies: [...familyCounts.values()].filter((count) => count > 1).length,
    newLexiconProfilesRequired: profileFamilies.size,
    reviewRequired: statusCounts.REVIEW_REQUIRED,
    unknown: statusCounts.UNKNOWN,
    nonLexicon: statusCounts.NON_LEXICON,
    complete: statusCounts.COMPLETE,
    partial: statusCounts.PARTIAL,
    categoryCounts,
    statusCounts,
    ambiguousProducts: rows.filter((row) => row.mappingUnique === "nein"),
  };
}

export function defaultCoverageProducts(): ShopCatalogProduct[] {
  return loadShopCatalogProducts();
}

export function liveShopCoverageMatrix(): ShopCoverageRow[] {
  return shopCoverageMatrix(
    LIVE_SHOP_PRODUCTS.map((row) => ({
      code: row.code,
      name: row.name,
      category: null,
      variantLabel: null,
      isActive: true,
    })),
  );
}

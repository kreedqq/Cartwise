export const COVERAGE_STATUSES = [
  "COMPLETE",
  "PARTIAL",
  "REVIEW_REQUIRED",
  "NON_LEXICON",
  "UNKNOWN",
] as const;

export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const SHOP_COVERAGE_CATEGORIES = [
  "PEPTIDES",
  "ORALS",
  "OILS / INJECTABLES",
  "BLENDS",
  "HILFSSTOFFE",
  "SONSTIGE",
] as const;

export type ShopCoverageCategory = (typeof SHOP_COVERAGE_CATEGORIES)[number];

export interface ShopCatalogProduct {
  code: string;
  name: string;
  category: string | null;
  variantLabel: string | null;
  isActive: boolean;
}

export interface ShopCoverageRow {
  code: string;
  name: string;
  shopCategory: string | null;
  coverageCategory: ShopCoverageCategory;
  substance: string;
  familySlug: string | null;
  researchSlug: string | null;
  variant: string;
  lexiconProfileRequired: "ja" | "nein";
  mappingUnique: "ja" | "nein";
  status: CoverageStatus;
  reason: string;
}

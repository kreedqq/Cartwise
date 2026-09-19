import { productImageUrl } from "@/lib/shop/productImage";
import { PEPTIX_CANONICAL_VIAL_PATH } from "@/lib/shop/portalTheme";
import { shopCategoryById, isShopCategoryId, type ShopCategoryId } from "@/lib/shopCategories";
import { siteDesignImageUrl } from "@/services/siteDesign";

export type ProductMediaKind =
  | "product"
  | "category"
  | "global-vial"
  | "area-vial"
  | "canonical"
  | "neutral";

export interface ResolvedProductMedia {
  src: string | null;
  kind: ProductMediaKind;
  alt: string;
}

function resolveStoredPath(path: string | undefined | null): string | null {
  if (!path?.trim()) return null;
  const p = path.trim();
  if (p.startsWith("http") || p.startsWith("/") || p.startsWith("data:")) return p;
  return siteDesignImageUrl(p);
}

function categoryMediaAlt(categoryKey: string | null | undefined, categoryLabel?: string): string {
  if (categoryLabel?.trim()) return `${categoryLabel.trim()} Kategorie`;
  if (categoryKey && isShopCategoryId(categoryKey)) {
    return `${shopCategoryById(categoryKey).label} Kategorie`;
  }
  return "Produktkategorie";
}

const VIAL_ALT = "PEPTIX Vial";

export type ResolveProductMediaInput = {
  productName: string;
  productImagePath?: string | null;
  /** Effective area catalog category key (not products.category). */
  effectiveCategoryKey?: string | null;
  categoryLabel?: string;
  /** designStudio.categoryMedia from site_design_settings */
  categoryMedia?: Record<string, string>;
  globalVialPath?: string | null;
  areaVialPath?: string | null;
};

/**
 * Ordered media candidates for runtime load-error fallback (deduped by URL).
 *
 * Priority: product → category → global vial → area vial → canonical vial.
 */
export function resolveProductMediaCandidates(input: ResolveProductMediaInput): ResolvedProductMedia[] {
  const productName = input.productName.trim() || "Produkt";
  const seen = new Set<string>();
  const out: ResolvedProductMedia[] = [];

  const push = (entry: ResolvedProductMedia) => {
    if (!entry.src || seen.has(entry.src)) return;
    seen.add(entry.src);
    out.push(entry);
  };

  const custom = productImageUrl(input.productImagePath);
  if (custom) {
    push({ src: custom, kind: "product", alt: productName });
  }

  const catKey = input.effectiveCategoryKey?.trim();
  if (catKey && input.categoryMedia?.[catKey]) {
    const url = resolveStoredPath(input.categoryMedia[catKey]);
    if (url) {
      push({
        src: url,
        kind: "category",
        alt: categoryMediaAlt(catKey, input.categoryLabel),
      });
    }
  }

  if (input.globalVialPath) {
    const url = resolveStoredPath(input.globalVialPath);
    if (url) push({ src: url, kind: "global-vial", alt: VIAL_ALT });
  }

  if (input.areaVialPath) {
    const url = resolveStoredPath(input.areaVialPath);
    if (url) push({ src: url, kind: "area-vial", alt: VIAL_ALT });
  }

  push({ src: PEPTIX_CANONICAL_VIAL_PATH, kind: "canonical", alt: VIAL_ALT });

  return out;
}

/**
 * Single product media resolution (shop cards, favorites, kit previews, admin preview).
 *
 * Priority: product image → global category media → global vial library → area vial → canonical vial → neutral.
 */
export function resolveProductMedia(input: ResolveProductMediaInput): ResolvedProductMedia {
  const candidates = resolveProductMediaCandidates(input);
  if (candidates[0]) return candidates[0];
  const productName = input.productName.trim() || "Produkt";
  return { src: null, kind: "neutral", alt: productName };
}

export function shopCategoryLabelForKey(key: string | null | undefined): string | undefined {
  if (!key || !isShopCategoryId(key)) return undefined;
  return shopCategoryById(key as ShopCategoryId).label;
}

import { productImageUrl } from "@/lib/shop/productImage";
import { PEPTIX_CANONICAL_VIAL_PATH } from "@/lib/shop/portalTheme";
import type { VialMediaConfig } from "@/lib/shop/portalAssets";
import { siteDesignImageUrl } from "@/services/siteDesign";

function resolveStoredPath(path: string | undefined): string | null {
  if (!path?.trim()) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return siteDesignImageUrl(path);
}

/**
 * Product hero resolution (most specific wins):
 * product.image_path → category vial → area vial → canonical PEPTIX vial.
 * Variant-level images use separate product rows (image_path per product).
 */
export function resolveProductHeroImage(input: {
  productImagePath: string | null | undefined;
  categoryKey?: string | null;
  vialMedia?: VialMediaConfig;
  globalVialPath?: string | null;
}): { src: string; kind: "product" | "category" | "area" | "global" | "canonical" } {
  const custom = productImageUrl(input.productImagePath);
  if (custom) return { src: custom, kind: "product" };

  const catKey = input.categoryKey?.trim();
  if (catKey && input.vialMedia?.categoryImages[catKey]) {
    const url = resolveStoredPath(input.vialMedia.categoryImages[catKey]);
    if (url) return { src: url, kind: "category" };
  }

  if (input.vialMedia?.areaImage) {
    const url = resolveStoredPath(input.vialMedia.areaImage);
    if (url) return { src: url, kind: "area" };
  }

  if (input.globalVialPath) {
    const url = resolveStoredPath(input.globalVialPath);
    if (url) return { src: url, kind: "global" };
  }

  return { src: PEPTIX_CANONICAL_VIAL_PATH, kind: "canonical" };
}

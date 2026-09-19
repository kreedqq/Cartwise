import type { VialMediaConfig } from "@/lib/shop/portalAssets";

import { resolveProductMedia, type ProductMediaKind } from "@/lib/shop/productMedia";

/** @deprecated Use resolveProductMedia — kept for callers migrating incrementally. */
export function resolveProductHeroImage(input: {
  productImagePath: string | null | undefined;
  categoryKey?: string | null;
  categoryLabel?: string;
  categoryMedia?: Record<string, string>;
  vialMedia?: VialMediaConfig;
  globalVialPath?: string | null;
  productName?: string;
}): { src: string; kind: ProductMediaKind | "area" | "global" } {
  const resolved = resolveProductMedia({
    productName: input.productName ?? "Produkt",
    productImagePath: input.productImagePath,
    effectiveCategoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
    categoryMedia: input.categoryMedia,
    globalVialPath: input.globalVialPath,
    areaVialPath: input.vialMedia?.areaImage,
  });
  const kind =
    resolved.kind === "area-vial"
      ? "area"
      : resolved.kind === "global-vial"
        ? "global"
        : resolved.kind;
  return { src: resolved.src ?? "", kind };
}

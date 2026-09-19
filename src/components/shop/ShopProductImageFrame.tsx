import * as React from "react";

import { productBadgeLabel } from "@/lib/shop/productBadge";
import { resolveProductMediaCandidates } from "@/lib/shop/productMedia";
import { productAccentStyle } from "@/lib/shop/productImage";
import { useSiteDesign } from "@/hooks/useTrustExperience";
import { productStageBackgroundStyle } from "@/lib/shop/portalTheme";
import { SHOP_GRID } from "@/lib/design/tokens";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export function ShopProductImageFrame({
  product,
  categoryLabel,
  categoryKey,
  favoriteControl,
  className,
}: {
  product: Tables<"products">;
  categoryLabel?: string;
  categoryKey?: string | null;
  favoriteControl?: React.ReactNode;
  className?: string;
}) {
  const { portalAccentHex, portal, vialMedia } = useShopAreaContext();
  const siteDesignQuery = useSiteDesign();
  const designStudio = siteDesignQuery.data?.designStudio;
  const badge = productBadgeLabel(product.badge_key);
  const stageStyle = productStageBackgroundStyle(portalAccentHex, portal.glow);
  const mediaInput = React.useMemo(
    () => ({
      productName: product.name,
      productImagePath: product.image_path,
      effectiveCategoryKey: categoryKey,
      categoryLabel,
      categoryMedia: designStudio?.categoryMedia,
      globalVialPath: designStudio?.globalVialPath,
      areaVialPath: vialMedia.areaImage,
    }),
    [
      product.name,
      product.image_path,
      categoryKey,
      categoryLabel,
      designStudio?.categoryMedia,
      designStudio?.globalVialPath,
      vialMedia.areaImage,
    ],
  );
  const candidates = React.useMemo(() => resolveProductMediaCandidates(mediaInput), [mediaInput]);
  const candidateChainKey = React.useMemo(
    () => candidates.map((c) => `${c.kind}:${c.src ?? ""}`).join("|"),
    [candidates],
  );
  const [fallback, setFallback] = React.useState({ chainKey: "", activeIndex: 0, exhausted: false });
  const activeIndex = fallback.chainKey === candidateChainKey ? fallback.activeIndex : 0;
  const exhausted = fallback.chainKey === candidateChainKey ? fallback.exhausted : false;

  const media = candidates[activeIndex];
  const showHero = Boolean(media?.src) && !exhausted;
  const neutralStyle = productAccentStyle(product.code || product.id);

  return (
    <div className={cn(SHOP_GRID.imageWrap, className)} style={stageStyle} data-testid="shop-product-image-stage">
      {badge ? (
        <span className={cn(SHOP_GRID.badge, "absolute left-2.5 top-2.5 z-20")}>{badge}</span>
      ) : null}
      {favoriteControl ? (
        <div className="absolute right-1.5 top-1.5 z-20 sm:right-2 sm:top-2">{favoriteControl}</div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" aria-hidden />
      <div className={cn(SHOP_GRID.imageInner, "relative z-[1] flex items-end justify-center px-0 pb-1 pt-2 sm:px-1")}>
        {showHero && media ? (
          <img
            key={`${activeIndex}:${media.src}`}
            src={media.src!}
            alt={media.alt}
            data-testid={
              media.kind === "canonical" || media.kind === "global-vial" || media.kind === "area-vial"
                ? "shop-product-canonical-vial"
                : media.kind === "category"
                  ? "shop-product-category-image"
                  : "shop-product-hero-image"
            }
            data-media-kind={media.kind}
            className="max-h-[98%] w-auto max-w-[92%] object-contain object-bottom drop-shadow-[0_22px_44px_rgba(0,0,0,0.7)] transition-transform duration-200 motion-reduce:transition-none group-hover/card:scale-[1.04]"
            loading="lazy"
            decoding="async"
            onError={() => {
              setFallback((prev) => {
                const index = prev.chainKey === candidateChainKey ? prev.activeIndex : 0;
                if (index + 1 < candidates.length) {
                  return { chainKey: candidateChainKey, activeIndex: index + 1, exhausted: false };
                }
                return { chainKey: candidateChainKey, activeIndex: index, exhausted: true };
              });
            }}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center pb-2 text-center"
            style={neutralStyle.css}
            data-testid="shop-product-media-neutral"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">PEPTIX</p>
            <p className="mt-1 max-w-[12rem] text-[10px] leading-snug text-muted-foreground">
              {exhausted && candidates[candidates.length - 1]?.kind === "canonical"
                ? "Bild nicht verfügbar — Canonical Vial prüfen."
                : "Produktbild nicht verfügbar."}
            </p>
          </div>
        )}
      </div>
      {categoryLabel ? (
        <span className="pointer-events-none absolute bottom-2 left-2.5 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
          {categoryLabel}
        </span>
      ) : null}
      {!showHero ? (
        <span className="sr-only">Produktbild nicht verfügbar — Canonical Vial Asset fehlt.</span>
      ) : null}
    </div>
  );
}

import * as React from "react";

import { productImageUrl } from "@/lib/shop/productImage";
import { productBadgeLabel } from "@/lib/shop/productBadge";
import { PEPTIX_CANONICAL_VIAL_PATH, productStageBackgroundStyle } from "@/lib/shop/portalTheme";
import { SHOP_GRID } from "@/lib/design/tokens";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export function ShopProductImageFrame({
  product,
  categoryLabel,
  favoriteControl,
  className,
}: {
  product: Tables<"products">;
  categoryLabel?: string;
  favoriteControl?: React.ReactNode;
  className?: string;
}) {
  const customSrc = productImageUrl(product.image_path);
  const { portalAccentHex, portal } = useShopAreaContext();
  const badge = productBadgeLabel(product.badge_key);
  const stageStyle = productStageBackgroundStyle(portalAccentHex, portal.glow);
  const [customError, setCustomError] = React.useState(false);
  const [canonicalError, setCanonicalError] = React.useState(false);

  const showCustom = Boolean(customSrc) && !customError;
  const showCanonical = !showCustom && !canonicalError;
  const heroMissing = !showCustom && !showCanonical;

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
        {showCustom ? (
          <img
            src={customSrc!}
            alt={product.name}
            className="max-h-[98%] w-full max-w-full object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.65)] transition-transform duration-200 motion-reduce:transition-none group-hover/card:scale-[1.03]"
            loading="lazy"
            decoding="async"
            onError={() => setCustomError(true)}
          />
        ) : showCanonical ? (
          <img
            src={PEPTIX_CANONICAL_VIAL_PATH}
            alt={product.name}
            data-testid="shop-product-canonical-vial"
            className="max-h-[98%] w-auto max-w-[92%] object-contain object-bottom drop-shadow-[0_22px_44px_rgba(0,0,0,0.7)] transition-transform duration-200 motion-reduce:transition-none group-hover/card:scale-[1.04]"
            loading="lazy"
            decoding="async"
            onError={() => setCanonicalError(true)}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-end pb-2 text-center"
            data-testid="shop-product-vial-missing"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">PEPTIX</p>
            <p className="mt-1 max-w-[12rem] text-[10px] leading-snug text-muted-foreground">
              Canonical Vial fehlt lokal — bitte{" "}
              <span className="font-mono text-[9px]">public/shop/peptix-vial-canonical.jpg</span> ablegen.
            </p>
          </div>
        )}
      </div>
      {categoryLabel ? (
        <span className="pointer-events-none absolute bottom-2 left-2.5 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
          {categoryLabel}
        </span>
      ) : null}
      {heroMissing ? (
        <span className="sr-only">Produktbild nicht verfügbar — Canonical Vial Asset fehlt.</span>
      ) : null}
    </div>
  );
}

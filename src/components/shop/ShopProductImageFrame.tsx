import { FlaskConical } from "lucide-react";

import { productAccentStyle, productImageUrl } from "@/lib/shop/productImage";
import { productBadgeLabel } from "@/lib/shop/productBadge";
import { SHOP_GRID } from "@/lib/design/tokens";
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
  const src = productImageUrl(product.image_path);
  const accent = productAccentStyle(product.code || product.name);
  const badge = productBadgeLabel(product.badge_key);

  return (
    <div className={cn(SHOP_GRID.imageWrap, className)} style={accent.css}>
      {badge ? (
        <span className={cn(SHOP_GRID.badge, "absolute left-2.5 top-2.5 z-20")}>{badge}</span>
      ) : null}
      {favoriteControl ? (
        <div className="absolute right-1.5 top-1.5 z-20 sm:right-2 sm:top-2">{favoriteControl}</div>
      ) : null}
      <div className={SHOP_GRID.imageInner}>
        {src ? (
          <img
            src={src}
            alt={product.name}
            className="h-full w-full object-contain object-center drop-shadow-[0_10px_24px_rgba(0,0,0,0.4)] transition-transform duration-200 motion-reduce:transition-none group-hover/card:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-center"
            aria-hidden
          >
            <div
              className="flex h-[72%] max-h-28 w-[38%] min-w-[3.25rem] max-w-[4.5rem] flex-col items-center justify-end rounded-t-full border border-white/10 bg-gradient-to-b from-white/12 to-white/5 pb-1.5 sm:max-h-32 sm:max-w-[5rem]"
              style={{ boxShadow: `0 10px 32px hsl(${accent.hue} 60% 40% / 0.32)` }}
            >
              <div className="mb-auto mt-1.5 h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="px-0.5 text-[8px] font-bold uppercase tracking-wider text-foreground/80 sm:text-[9px]">
                {product.code.slice(0, 6)}
              </span>
            </div>
            <FlaskConical className="h-4 w-4 text-muted-foreground/50 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>
      {categoryLabel ? (
        <span className="pointer-events-none absolute bottom-2 left-2.5 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
          {categoryLabel}
        </span>
      ) : null}
    </div>
  );
}

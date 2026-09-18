import { ArrowRight } from "lucide-react";

import { ShopPortalAtmosphere } from "@/components/shop/ShopPortalAtmosphere";
import type { PortalAtmosphere } from "@/lib/shop/portalTheme";
import { cn } from "@/lib/utils";

export function ShopCategoryPortal({
  title,
  productCount,
  onSelect,
  accentHex,
  glow = 45,
  atmosphere = "energy",
  portalAssetUrl,
  categoryKey,
  icon: _icon,
}: {
  title: string;
  categoryKey?: string;
  productCount?: number;
  onSelect: () => void;
  accentHex: string;
  glow?: number;
  atmosphere?: PortalAtmosphere;
  portalAssetUrl?: string | null;
  /** Optional — portal artwork is primary; icon not shown in chrome */
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid="shop-category-portal"
      data-category-key={categoryKey}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-[13rem] w-full overflow-hidden rounded-lg text-left sm:min-h-[14.5rem]",
        "border border-white/[0.05] bg-transparent",
        "transition-[transform,box-shadow,border-color] duration-300 motion-reduce:transition-none",
        "hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--portal-accent)_35%,transparent)]",
        "hover:shadow-[0_20px_56px_-24px_color-mix(in_srgb,var(--portal-accent)_45%,transparent)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      style={{ ["--portal-accent" as string]: accentHex }}
    >
      <ShopPortalAtmosphere
        accentHex={accentHex}
        glow={glow}
        atmosphere={atmosphere}
        portalAssetUrl={portalAssetUrl}
        intensity="gateway"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[48%] bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="relative z-10 mt-auto flex w-full flex-col p-4 pt-16">
        <p className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground drop-shadow-sm">
          {title}
        </p>
        {typeof productCount === "number" ? (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {productCount} {productCount === 1 ? "Produkt" : "Produkte"}
          </p>
        ) : null}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--portal-accent)]">
          Entdecken
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </div>
    </button>
  );
}

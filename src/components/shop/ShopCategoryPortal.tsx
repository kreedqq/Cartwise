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
  icon,
}: {
  title: string;
  productCount?: number;
  onSelect: () => void;
  accentHex: string;
  glow?: number;
  atmosphere?: PortalAtmosphere;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid="shop-category-portal"
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-[10.5rem] w-full overflow-hidden rounded-xl border border-white/10 text-left",
        "transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none",
        "hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--portal-accent)_40%,transparent)]",
        "hover:shadow-[0_16px_48px_-20px_color-mix(in_srgb,var(--portal-accent)_50%,transparent)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      style={{ ["--portal-accent" as string]: accentHex }}
    >
      <ShopPortalAtmosphere accentHex={accentHex} glow={glow} atmosphere={atmosphere} intensity="subtle" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-2">
          {icon ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/35 text-[color:var(--portal-accent)]">
              {icon}
            </span>
          ) : (
            <span className="h-9 w-9" />
          )}
          {typeof productCount === "number" ? (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {productCount} {productCount === 1 ? "Produkt" : "Produkte"}
            </span>
          ) : null}
        </div>
        <div>
          <p className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--portal-accent)]">
            Entdecken
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </div>
      </div>
    </button>
  );
}

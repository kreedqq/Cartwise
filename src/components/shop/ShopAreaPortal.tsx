import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { ShopPortalAtmosphere } from "@/components/shop/ShopPortalAtmosphere";
import { UI_TYPE } from "@/lib/design/tokens";
import type { PortalAtmosphere } from "@/lib/shop/portalTheme";
import { cn } from "@/lib/utils";

export interface ShopAreaPortalProps {
  title: string;
  description: string;
  href: string;
  accentHex: string;
  glow?: number;
  atmosphere?: PortalAtmosphere;
  backgroundImageUrl?: string | null;
  portalAssetUrl?: string | null;
  icon?: React.ReactNode;
  badge?: string | null;
  metaLabel?: string;
  ctaLabel?: string;
  disabled?: boolean;
  layout?: "hub" | "stack";
}

export function ShopAreaPortal({
  title,
  description,
  href,
  accentHex,
  glow = 55,
  atmosphere = "energy",
  backgroundImageUrl,
  portalAssetUrl,
  icon: _icon,
  badge,
  metaLabel,
  ctaLabel = "Betreten",
  disabled,
  layout = "hub",
}: ShopAreaPortalProps) {
  const minH =
    layout === "hub" ? "min-h-[20rem] sm:min-h-[26rem] lg:min-h-[30rem]" : "min-h-[14rem] sm:min-h-[16rem]";

  const inner = (
    <>
      <ShopPortalAtmosphere
        accentHex={accentHex}
        glow={glow}
        atmosphere={atmosphere}
        backgroundImageUrl={backgroundImageUrl}
        portalAssetUrl={portalAssetUrl}
        intensity={layout === "hub" ? "hub" : "standard"}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t to-transparent",
          layout === "hub"
            ? "h-[30%] from-background/75 via-background/35"
            : "h-[34%] from-background via-background/55",
        )}
      />
      <div
        className={cn(
          "relative z-20 mt-auto flex flex-col justify-end",
          layout === "hub" ? "p-3 pb-4 sm:p-4 sm:pb-5" : "p-4 pb-5 sm:p-5 sm:pb-6",
        )}
      >
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {metaLabel ? (
              <p className={cn(UI_TYPE.status, "text-[color:var(--portal-accent)]")}>{metaLabel}</p>
            ) : null}
            <h3
              className={cn(
                "font-display font-semibold leading-[1.02] tracking-tight text-foreground drop-shadow-md",
                layout === "hub" ? "text-xl sm:text-2xl" : "text-lg sm:text-xl",
              )}
            >
              {title}
            </h3>
          </div>
          {badge ? (
            <span className="shrink-0 rounded-md border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 line-clamp-2 max-w-lg text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {description}
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--portal-accent)] sm:text-sm">
          {disabled ? "Bald verfügbar" : ctaLabel}
          {!disabled ? (
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          ) : null}
        </span>
      </div>
    </>
  );

  const className = cn(
    "group relative flex overflow-hidden",
    layout === "hub"
      ? "rounded-lg sm:rounded-xl border-0 bg-transparent shadow-none hover:shadow-[0_40px_100px_-60px_color-mix(in_srgb,var(--portal-accent)_45%,transparent)]"
      : "rounded-xl sm:rounded-2xl border border-white/[0.04] bg-transparent shadow-[0_32px_90px_-55px_color-mix(in_srgb,var(--portal-accent)_50%,transparent)] hover:shadow-[0_48px_130px_-52px_color-mix(in_srgb,var(--portal-accent)_65%,transparent)]",
    "ring-0 transition-[transform,box-shadow] duration-300 motion-reduce:transition-none",
    "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
    minH,
    disabled && "pointer-events-none opacity-60",
  );

  if (disabled) {
    return (
      <div className={className} style={{ ["--portal-accent" as string]: accentHex }}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={href}
      className={className}
      style={{ ["--portal-accent" as string]: accentHex }}
      data-testid="shop-area-portal"
    >
      {inner}
    </Link>
  );
}

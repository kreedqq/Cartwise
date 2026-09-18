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
  focalImageUrl?: string | null;
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
  focalImageUrl,
  icon,
  badge,
  metaLabel,
  ctaLabel = "Betreten",
  disabled,
  layout = "hub",
}: ShopAreaPortalProps) {
  const minH = layout === "hub" ? "min-h-[17.5rem] sm:min-h-[19rem]" : "min-h-[11rem] sm:min-h-[12rem]";

  const inner = (
    <>
      <ShopPortalAtmosphere
        accentHex={accentHex}
        glow={glow}
        atmosphere={atmosphere}
        backgroundImageUrl={backgroundImageUrl}
        focalImageUrl={focalImageUrl}
        intensity={layout === "hub" ? "hero" : "standard"}
      />
      <div className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon ? (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-[color:var(--portal-accent)] backdrop-blur-sm"
                style={{ boxShadow: `0 0 20px color-mix(in srgb, ${accentHex} 25%, transparent)` }}
              >
                {icon}
              </span>
            ) : null}
            {metaLabel ? <span className={cn(UI_TYPE.status, "text-[color:var(--portal-accent)]")}>{metaLabel}</span> : null}
          </div>
          {badge ? (
            <span className="rounded-md border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/90">
              {badge}
            </span>
          ) : null}
        </div>
        <h3
          className={cn(
            "mt-4 font-display font-semibold leading-[1.05] tracking-tight text-foreground",
            layout === "hub" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </h3>
        <p className="mt-2 max-w-md line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--portal-accent)]">
          {disabled ? "Bald verfügbar" : `${ctaLabel} →`}
          {!disabled ? <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" /> : null}
        </span>
      </div>
    </>
  );

  const className = cn(
    "group relative flex overflow-hidden rounded-2xl border border-white/10 bg-black/20",
    "transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none",
    "hover:border-[color:color-mix(in_srgb,var(--portal-accent)_45%,transparent)] hover:shadow-[0_20px_60px_-24px_color-mix(in_srgb,var(--portal-accent)_55%,transparent)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
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

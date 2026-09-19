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
  /** First visible hub portal — eager image load */
  priorityImage?: boolean;
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
  priorityImage = false,
}: ShopAreaPortalProps) {
  const ariaLabel = disabled ? `${title} — bald verfügbar` : `${title} betreten`;

  const className = cn(
    "group flex w-full flex-col items-center gap-2 text-center sm:gap-3",
    "rounded-none border-0 bg-transparent shadow-none outline-none",
    "transition-[transform,filter] duration-[180ms] ease-out motion-reduce:transition-none",
    "hover:-translate-y-1 motion-reduce:hover:translate-y-0",
    "focus-visible:outline-none focus-visible:ring-0",
    "focus-visible:[filter:drop-shadow(0_0_18px_color-mix(in_srgb,var(--portal-accent)_55%,transparent))]",
    disabled && "pointer-events-none opacity-60",
  );

  const portalBlock = (
    <div className="relative w-full max-w-[min(94vw,34rem)] xl:max-w-[min(94vw,36rem)]">
      <ShopPortalAtmosphere
        accentHex={accentHex}
        glow={glow}
        atmosphere={atmosphere}
        backgroundImageUrl={backgroundImageUrl}
        portalAssetUrl={portalAssetUrl}
        intensity={layout === "hub" ? "hub" : "standard"}
        presentation={backgroundImageUrl ? "scene" : "entrance"}
        priorityImage={priorityImage}
      />
    </div>
  );

  const copyBlock = (
    <div className="max-w-md space-y-1 px-1">
      {metaLabel ? (
        <p className={cn(UI_TYPE.status, "text-[color:var(--portal-accent)]")}>{metaLabel}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl">
          {title}
        </h3>
        {badge ? (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--portal-accent)]">
            {badge}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
      ) : null}
      {!disabled ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--portal-accent)] sm:text-xs">
          {ctaLabel}
        </p>
      ) : (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bald verfügbar</p>
      )}
    </div>
  );

  if (disabled) {
    return (
      <div className={className} style={{ ["--portal-accent" as string]: accentHex }} aria-label={ariaLabel}>
        {portalBlock}
        {copyBlock}
      </div>
    );
  }

  return (
    <Link
      to={href}
      className={className}
      style={{ ["--portal-accent" as string]: accentHex }}
      data-testid="shop-area-portal"
      aria-label={ariaLabel}
    >
      {portalBlock}
      {copyBlock}
    </Link>
  );
}

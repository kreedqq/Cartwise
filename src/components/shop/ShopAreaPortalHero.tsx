import { ShopPortalAtmosphere } from "@/components/shop/ShopPortalAtmosphere";
import { UI_TYPE } from "@/lib/design/tokens";
import type { PortalAtmosphere } from "@/lib/shop/portalTheme";
import { cn } from "@/lib/utils";

/** Cinematic entrance when browsing categories inside a Shop Area. */
export function ShopAreaPortalHero({
  areaName,
  title,
  subtitle,
  accentHex,
  glow = 50,
  atmosphere = "energy",
  backgroundImageUrl,
  portalAssetUrl,
  className,
  /** When page already has a headline (e.g. Group Buy kit hero), show portal band only */
  portalBandOnly = false,
}: {
  areaName: string;
  title?: string;
  subtitle?: string;
  accentHex: string;
  glow?: number;
  atmosphere?: PortalAtmosphere;
  backgroundImageUrl?: string | null;
  portalAssetUrl?: string | null;
  className?: string;
  portalBandOnly?: boolean;
}) {
  const useScene = Boolean(backgroundImageUrl);

  return (
    <section
      className={cn(
        "group relative",
        useScene && "overflow-hidden rounded-lg border border-white/[0.04] sm:rounded-xl",
        useScene && (portalBandOnly ? "min-h-[10.5rem] sm:min-h-[13rem]" : "min-h-[12rem] sm:min-h-[16rem]"),
        !useScene && "flex flex-col items-center gap-3 py-2",
        portalBandOnly && useScene && "border-0",
        className,
      )}
      style={{ ["--portal-accent" as string]: accentHex }}
    >
      <ShopPortalAtmosphere
        accentHex={accentHex}
        glow={glow}
        atmosphere={atmosphere}
        backgroundImageUrl={backgroundImageUrl}
        portalAssetUrl={portalAssetUrl}
        intensity={portalBandOnly ? "hub" : "hero"}
        presentation={useScene ? "scene" : "entrance"}
        className={useScene ? undefined : "w-full max-w-[min(94vw,26rem)]"}
      />
      {!portalBandOnly ? (
        <div
          className={cn(
            "space-y-1 text-center",
            useScene && "relative z-10 flex min-h-[12rem] flex-col justify-end p-4 sm:min-h-[16rem] sm:p-6",
          )}
        >
          <p className={UI_TYPE.eyebrow}>{areaName}</p>
          <h1 className="font-display text-2xl font-semibold leading-[1.05] tracking-tight sm:text-3xl">
            {title || areaName}
          </h1>
          {subtitle ? <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
        </div>
      ) : useScene ? (
        <div className="relative z-10 flex min-h-[10.5rem] items-end p-3 sm:min-h-[13rem] sm:p-4">
          <p className={cn(UI_TYPE.eyebrow, "text-[color:var(--portal-accent)]")}>{areaName}</p>
        </div>
      ) : null}
    </section>
  );
}

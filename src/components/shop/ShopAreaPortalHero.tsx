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
  focalImageUrl,
  className,
}: {
  areaName: string;
  title?: string;
  subtitle?: string;
  accentHex: string;
  glow?: number;
  atmosphere?: PortalAtmosphere;
  backgroundImageUrl?: string | null;
  focalImageUrl?: string | null;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10",
        "min-h-[11rem] sm:min-h-[12.5rem]",
        className,
      )}
      style={{ ["--portal-accent" as string]: accentHex }}
    >
      <ShopPortalAtmosphere
        accentHex={accentHex}
        glow={glow}
        atmosphere={atmosphere}
        backgroundImageUrl={backgroundImageUrl}
        focalImageUrl={focalImageUrl}
        intensity="standard"
      />
      <div className="relative z-10 flex flex-col justify-end p-5 sm:p-6">
        <p className={UI_TYPE.eyebrow}>{areaName}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-[1.05] tracking-tight sm:text-3xl">
          {title || areaName}
        </h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
      </div>
    </section>
  );
}

import { cn } from "@/lib/utils";
import type { PortalAtmosphere } from "@/lib/shop/portalTheme";
import { portalAtmosphereLayers } from "@/lib/shop/portalTheme";

/** World environment + dimensional portal asset (transparent PNG). */
export function ShopPortalAtmosphere({
  accentHex,
  glow,
  atmosphere,
  backgroundImageUrl,
  portalAssetUrl,
  className,
  intensity = "standard",
}: {
  accentHex: string;
  glow: number;
  atmosphere: PortalAtmosphere;
  backgroundImageUrl?: string | null;
  /** Primary portal artwork — replaces CSS oval when set */
  portalAssetUrl?: string | null;
  className?: string;
  intensity?: "subtle" | "standard" | "hero" | "hub" | "gateway";
}) {
  const g = Math.min(1, Math.max(0, glow / 100));
  const particleOpacity = atmosphere === "molecule" ? 0.45 : atmosphere === "void" ? 0.2 : 0.32;
  const portalTop =
    intensity === "hero"
      ? "48%"
      : intensity === "hub"
        ? "42%"
        : intensity === "gateway"
          ? "46%"
          : intensity === "subtle"
            ? "48%"
            : "44%";
  const portalMax =
    intensity === "hero"
      ? "min(96vw,40rem)"
      : intensity === "hub"
        ? "min(94vw,28rem)"
        : intensity === "gateway"
          ? "min(88%,17rem)"
          : intensity === "subtle"
            ? "min(92%,16rem)"
            : "min(92vw,24rem)";

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute inset-0 bg-[#020204]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: backgroundImageUrl
            ? `linear-gradient(180deg, rgba(2,2,4,0.35) 0%, rgba(2,2,4,0.92) 100%), url(${backgroundImageUrl})`
            : `radial-gradient(ellipse 130% 100% at 50% 0%, color-mix(in srgb, ${accentHex} 14%, #0a0a12), #020204 68%)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className={cn("absolute inset-0", portalAtmosphereLayers(atmosphere))}
        style={{
          background: `radial-gradient(ellipse 110% 80% at 50% 35%, color-mix(in srgb, ${accentHex} ${Math.round(18 + g * 28)}%, transparent), transparent 72%)`,
        }}
      />
      {portalAssetUrl ? (
        <>
          <div
            className="peptix-portal-glow absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full motion-reduce:animate-none"
            style={{
              top: portalTop,
              width: portalMax,
              height: portalMax,
              background: `radial-gradient(circle, color-mix(in srgb, ${accentHex} ${Math.round(22 + g * 28)}%, transparent) 0%, transparent 72%)`,
              filter: "blur(22px)",
              opacity: 0.85,
            }}
          />
          <img
            src={portalAssetUrl}
            alt=""
            className={cn(
              "peptix-portal-asset absolute left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_45px_color-mix(in_srgb,var(--portal-accent)_55%,transparent)]",
              "transition-transform duration-300 motion-reduce:transition-none",
              "group-hover:scale-[1.04] group-hover:brightness-110 motion-reduce:group-hover:scale-100",
            )}
            style={{ top: portalTop, width: portalMax, height: portalMax, maxHeight: portalMax }}
          />
        </>
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          opacity: particleOpacity,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.35) 0.4px, transparent 0.55px)`,
          backgroundSize: atmosphere === "molecule" ? "24px 24px" : "36px 36px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 38%, black, transparent)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.65)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
    </div>
  );
}

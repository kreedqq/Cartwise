import { cn } from "@/lib/utils";
import type { PortalAtmosphere } from "@/lib/shop/portalTheme";
import { portalAtmosphereLayers } from "@/lib/shop/portalTheme";

/** Shared atmospheric layers for area + category portals (CSS-only, no pasted reference art). */
export function ShopPortalAtmosphere({
  accentHex,
  glow,
  atmosphere,
  backgroundImageUrl,
  focalImageUrl,
  className,
  intensity = "standard",
}: {
  accentHex: string;
  glow: number;
  atmosphere: PortalAtmosphere;
  backgroundImageUrl?: string | null;
  focalImageUrl?: string | null;
  className?: string;
  intensity?: "subtle" | "standard" | "hero";
}) {
  const g = Math.min(1, Math.max(0, glow / 100));
  const ringScale = intensity === "hero" ? 1.2 : intensity === "subtle" ? 0.82 : 1;
  const particleOpacity = atmosphere === "molecule" ? 0.55 : atmosphere === "void" ? 0.25 : 0.4;
  const ringSize = intensity === "subtle" ? "min(36%,7.5rem)" : "min(44%,11rem)";

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div
        className="absolute inset-0 bg-[#030306]"
        style={{
          backgroundImage: backgroundImageUrl
            ? `linear-gradient(180deg, rgba(3,3,6,0.55) 0%, rgba(3,3,6,0.92) 100%), url(${backgroundImageUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(ellipse 120% 90% at 50% 0%, color-mix(in srgb, ${accentHex} 12%, transparent), transparent 55%)`,
        }}
      />
      <div
        className={cn("absolute inset-0", portalAtmosphereLayers(atmosphere))}
        style={{
          background: `radial-gradient(ellipse ${Math.round(130 * ringScale)}% ${Math.round(95 * ringScale)}% at 50% 42%, color-mix(in srgb, ${accentHex} ${Math.round(22 + g * 32)}%, transparent), transparent 70%)`,
        }}
      />
      <div
        className="absolute left-1/2 top-[40%] h-[min(58%,16rem)] w-[min(58%,16rem)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 blur-3xl motion-reduce:blur-xl"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accentHex} ${Math.round(40 + g * 45)}%, transparent) 0%, transparent 72%)`,
        }}
      />
      {focalImageUrl ? (
        <img
          src={focalImageUrl}
          alt=""
          className="absolute left-1/2 top-[40%] max-h-[min(50%,13rem)] max-w-[min(50%,13rem)] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.32] mix-blend-screen"
        />
      ) : (
        <>
          <div
            className={cn(
              "peptix-portal-ring absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full",
            )}
            style={{
              width: ringSize,
              height: ringSize,
              boxShadow: `
                0 0 ${Math.round(28 + g * 56)}px color-mix(in srgb, ${accentHex} ${Math.round(30 + g * 40)}%, transparent),
                inset 0 0 ${Math.round(20 + g * 30)}px color-mix(in srgb, ${accentHex} 18%, transparent)
              `,
              border: `1px solid color-mix(in srgb, ${accentHex} ${Math.round(35 + g * 25)}%, transparent)`,
              background: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${accentHex} 8%, transparent) 0%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.92) 100%)`,
            }}
          />
          <div
            className="absolute left-1/2 top-[40%] h-[min(28%,5rem)] w-[min(28%,5rem)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${accentHex} ${Math.round(55 + g * 30)}%, white 5%) 0%, transparent 70%)`,
              filter: "blur(8px)",
            }}
          />
        </>
      )}
      <div
        className="absolute inset-0"
        style={{
          opacity: particleOpacity,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.45) 0.45px, transparent 0.55px)`,
          backgroundSize: atmosphere === "molecule" ? "22px 22px" : "32px 32px",
          maskImage: "radial-gradient(ellipse 85% 65% at 50% 38%, black, transparent)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-transparent to-transparent" />
    </div>
  );
}

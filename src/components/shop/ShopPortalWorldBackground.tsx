import { cn } from "@/lib/utils";

/** Shared PEPTIX portal-world atmosphere (not a per-portal flat sheet). */
export function ShopPortalWorldBackground({
  accentHex = "#22d3ee",
  className,
  intensity = "area",
}: {
  accentHex?: string;
  className?: string;
  /** hub = stronger depth for /shop gallery */
  intensity?: "hub" | "area";
}) {
  const accentStrength = intensity === "hub" ? 22 : 14;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <div className="absolute inset-0 bg-[#030308]" />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: `
            radial-gradient(ellipse 120% 70% at 50% -10%, color-mix(in srgb, ${accentHex} ${accentStrength}%, transparent), transparent 55%),
            radial-gradient(ellipse 80% 50% at 85% 20%, color-mix(in srgb, #c9a227 8%, transparent), transparent 50%),
            radial-gradient(ellipse 70% 45% at 10% 75%, color-mix(in srgb, ${accentHex} 10%, transparent), transparent 52%),
            linear-gradient(180deg, #050510 0%, #020204 45%, #010102 100%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04) 0, transparent 42%),
            radial-gradient(circle at 78% 62%, rgba(255,255,255,0.03) 0, transparent 38%)
          `,
        }}
      />
      <div
        className="peptix-world-molecules absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `
            linear-gradient(90deg, transparent 49.5%, color-mix(in srgb, ${accentHex} 35%, transparent) 50%, transparent 50.5%),
            linear-gradient(0deg, transparent 49.5%, color-mix(in srgb, ${accentHex} 25%, transparent) 50%, transparent 50.5%)
          `,
          backgroundSize: intensity === "hub" ? "64px 64px" : "48px 48px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 40%, black, transparent)",
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.45) 0.35px, transparent 0.55px)",
          backgroundSize: intensity === "hub" ? "28px 28px" : "32px 32px",
          maskImage: "radial-gradient(ellipse 85% 65% at 50% 35%, black 20%, transparent 72%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#010102] via-[#010102]/80 to-transparent" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

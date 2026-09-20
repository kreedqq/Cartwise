import { cn } from "@/lib/utils";

import type { PortalAtmosphere } from "@/lib/shop/portalTheme";

import { portalAtmosphereLayers } from "@/lib/shop/portalTheme";

import { resolvePortalAssetPublicUrl } from "@/lib/shop/portalAssets";



/** World environment + dimensional portal asset (transparent PNG). */

export function ShopPortalAtmosphere({

  accentHex,

  glow,

  atmosphere,

  backgroundImageUrl,

  portalAssetUrl,

  className,

  intensity = "standard",

  /** entrance = floating PNG on page background; scene = full-bleed cinematic (legacy hero) */

  presentation = "entrance",

  priorityImage = false,

}: {

  accentHex: string;

  glow: number;

  atmosphere: PortalAtmosphere;

  backgroundImageUrl?: string | null;

  /** Primary portal artwork — replaces CSS oval when set */

  portalAssetUrl?: string | null;

  className?: string;

  intensity?: "subtle" | "standard" | "hero" | "hub" | "gateway";

  presentation?: "entrance" | "scene";

  priorityImage?: boolean;

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

      ? "min(96vw,42rem)"

      : intensity === "hub"

        ? "min(100%,34rem)"

        : intensity === "gateway"

          ? "min(92vw,20rem)"

          : intensity === "subtle"

            ? "min(92%,16rem)"

            : "min(92vw,26rem)";



  const resolvedAsset =

    portalAssetUrl?.trim() ||

    resolvePortalAssetPublicUrl({ assetId: undefined, customPath: undefined, legacyOrbPath: undefined });



  const useScene = presentation === "scene" && Boolean(backgroundImageUrl);



  const entranceMinHeight =

    intensity === "hub"

      ? "13rem"

      : intensity === "gateway"

        ? "11rem"

        : intensity === "hero"

          ? "15rem"

          : "11rem";



  const glowSize = `calc(${portalMax} * 0.88)`;

  const dropGlow = `drop-shadow(0 0 ${Math.round(28 + g * 36)}px color-mix(in srgb, ${accentHex} ${Math.round(45 + g * 35)}%, transparent))`;



  if (!useScene) {

    return (

      <div

        className={cn("relative mx-auto flex w-full items-center justify-center", className)}

        aria-hidden

        style={{ minHeight: entranceMinHeight, ["--portal-accent" as string]: accentHex }}

      >

        {resolvedAsset ? (

          <>

            <div

              className="peptix-portal-glow-pulse absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 motion-reduce:animate-none"

              style={{

                width: glowSize,

                height: glowSize,

                background: `radial-gradient(circle, color-mix(in srgb, ${accentHex} ${Math.round(16 + g * 34)}%, transparent) 0%, transparent 68%)`,

                filter: "blur(32px)",

                opacity: 0.8,

              }}

            />

            <div

              className={cn(

                "peptix-portal-glow-pulse absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 motion-reduce:animate-none",

                portalAtmosphereLayers(atmosphere),

              )}

              style={{

                width: `calc(${portalMax} * 0.75)`,

                height: `calc(${portalMax} * 0.75)`,

                background: `radial-gradient(circle, color-mix(in srgb, ${accentHex} ${Math.round(8 + g * 16)}%, transparent), transparent 70%)`,

                opacity: 0.5,

                animationDelay: "0.8s",

              }}

            />

            <img

              src={resolvedAsset}

              alt=""

              decoding="async"

              loading={priorityImage || intensity === "gateway" ? "eager" : "lazy"}

              fetchPriority={priorityImage || intensity === "gateway" ? "high" : "auto"}

              className={cn(

                "peptix-portal-asset peptix-portal-asset-idle relative z-[2] w-full max-w-full object-contain",

                "transition-[transform,filter] duration-[180ms] ease-out motion-reduce:transition-none",

                "group-hover:scale-[1.05] group-hover:brightness-[1.08] motion-reduce:group-hover:scale-100",

                "group-focus-visible:scale-[1.03] group-focus-visible:brightness-105",

              )}

              style={{

                width: portalMax,

                height: portalMax,

                maxHeight: portalMax,

                filter: `${dropGlow} drop-shadow(0 18px 28px rgba(0,0,0,0.45))`,

              }}

            />

            <div

              className="pointer-events-none absolute left-1/2 top-[62%] z-[1] -translate-x-1/2 opacity-35 transition-opacity duration-200 group-hover:opacity-55 motion-reduce:transition-none"

              style={{

                width: `calc(${portalMax} * 0.72)`,

                height: "2.5rem",

                background: `radial-gradient(ellipse 100% 100% at 50% 0%, color-mix(in srgb, ${accentHex} 35%, transparent), transparent 70%)`,

                filter: "blur(8px)",

                transform: "translateX(-50%) scaleY(-0.35)",

              }}

            />

            <div

              className="pointer-events-none absolute left-1/2 top-[46%] z-[1] -translate-x-1/2 -translate-y-1/2 motion-reduce:animate-none"

              style={{

                width: glowSize,

                height: glowSize,

                opacity: particleOpacity * 0.55,

                backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.4) 0.35px, transparent 0.55px)`,

                backgroundSize: atmosphere === "molecule" ? "20px 20px" : "30px 30px",

                maskImage: "radial-gradient(circle at center, black 38%, transparent 68%)",

              }}

            />

          </>

        ) : null}

      </div>

    );

  }



  return (

    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>

      <div className="absolute inset-0 bg-[#020204]" />

      <div

        className="absolute inset-0"

        style={{

          backgroundImage: `linear-gradient(180deg, rgba(2,2,4,0.35) 0%, rgba(2,2,4,0.92) 100%), url(${backgroundImageUrl})`,

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

      {resolvedAsset ? (

        <>

          <div

            className="peptix-portal-glow-pulse absolute left-1/2 -translate-x-1/2 -translate-y-1/2 motion-reduce:animate-none"

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

            src={resolvedAsset}

            alt=""

            decoding="async"

            loading={priorityImage ? "eager" : "lazy"}

            className={cn(

              "peptix-portal-asset peptix-portal-asset-idle absolute left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain",

              "transition-transform duration-200 motion-reduce:transition-none",

              "group-hover:scale-[1.04] group-hover:brightness-110 motion-reduce:group-hover:scale-100",

            )}

            style={{

              top: portalTop,

              width: portalMax,

              height: portalMax,

              maxHeight: portalMax,

              filter: dropGlow,

            }}

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


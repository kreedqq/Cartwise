import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { areaBackgroundStyle, type AreaThemeConfig } from "@/lib/shop/areaTheme";
import { cn } from "@/lib/utils";
import { siteDesignImageUrl } from "@/services/siteDesign";

function resolveImage(path: string): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("/")) {
    return path;
  }
  return siteDesignImageUrl(path) ?? "";
}

function resolvedTheme(theme: AreaThemeConfig): AreaThemeConfig {
  return {
    ...theme,
    background: {
      ...theme.background,
      desktopImage: resolveImage(theme.background.desktopImage),
      tabletImage: resolveImage(theme.background.tabletImage),
      mobileImage: resolveImage(theme.background.mobileImage),
    },
    hero: {
      ...theme.hero,
      desktopImage: resolveImage(theme.hero.desktopImage),
      mobileImage: resolveImage(theme.hero.mobileImage),
    },
  };
}

export function AreaStorefrontChrome({
  theme,
  areaName,
  children,
}: {
  theme: AreaThemeConfig;
  areaName: string;
  children: ReactNode;
}) {
  const live = resolvedTheme(theme);
  const bg = areaBackgroundStyle(live);
  const overlay =
    live.enabled && live.background.mode === "image" && live.background.overlay
      ? `rgba(0,0,0,${Math.min(90, Math.max(0, live.background.overlayStrength)) / 100})`
      : null;

  return (
    <div className="relative min-w-0" style={live.background.mode === "image" ? undefined : bg}>
      {live.enabled && live.background.mode === "image" && (live.background.desktopImage || live.background.mobileImage) ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          style={bg}
        >
          {overlay ? <div className="absolute inset-0" style={{ background: overlay }} /> : null}
        </div>
      ) : null}
      {live.hero.enabled ? <AreaHero theme={live} areaName={areaName} /> : null}
      {live.banner.enabled && (live.banner.title || live.banner.description) ? (
        <div className="mb-6 rounded-xl border border-border bg-card/80 px-4 py-3">
          {live.banner.title ? <p className="text-sm font-semibold">{live.banner.title}</p> : null}
          {live.banner.description ? <p className="text-sm text-muted-foreground">{live.banner.description}</p> : null}
          {live.banner.buttonText && live.banner.buttonHref ? (
            <Button asChild size="sm" className="mt-2">
              <Link to={live.banner.buttonHref}>{live.banner.buttonText}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function AreaHero({ theme, areaName }: { theme: AreaThemeConfig; areaName: string }) {
  const hero = theme.hero;
  const image = hero.desktopImage || hero.mobileImage;
  const height =
    hero.height === "compact" ? "min-h-36" : hero.height === "tall" ? "min-h-72" : "min-h-48";
  const align =
    hero.alignment === "center" ? "items-center text-center" : hero.alignment === "right" ? "items-end text-right" : "items-start text-left";

  return (
    <section
      className={cn(
        "relative mb-6 overflow-hidden rounded-2xl border border-border",
        height,
        hero.variant === "split" ? "grid gap-4 md:grid-cols-2" : "flex flex-col justify-end",
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{ background: `rgba(0,0,0,${Math.min(80, Math.max(0, hero.overlayStrength)) / 100})` }}
      />
      <div className={cn("relative z-10 flex flex-col gap-2 p-5", align)}>
        <p className="text-lg font-semibold text-white">{hero.title || areaName}</p>
        {hero.subtitle ? <p className="text-sm text-white/80">{hero.subtitle}</p> : null}
        {hero.description ? <p className="max-w-xl text-sm text-white/70">{hero.description}</p> : null}
        {hero.buttonText && hero.buttonHref ? (
          <Button asChild size="sm" className="mt-1 w-fit">
            <Link to={hero.buttonHref}>{hero.buttonText}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}

import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { UI_TYPE } from "@/lib/design/tokens";
import { AreaGlyph } from "@/lib/shop/areaIcons";
import { parseAreaTheme } from "@/lib/shop/areaTheme";
import { isGroupBuyPricing, type MyShopArea } from "@/lib/shop/shopAreas";
import { cn } from "@/lib/utils";
import { siteDesignImageUrl } from "@/services/siteDesign";

function areaCopy(area: MyShopArea) {
  const theme = parseAreaTheme(area.theme);
  const isGb = isGroupBuyPricing(area.pricing_profile);
  return {
    theme,
    isGb,
    title: theme.hub.title || area.name,
    subtitle:
      theme.hub.description ||
      area.subtitle ||
      (isGb ? "Kits teilen · nur den eigenen Anteil zahlen" : "Einzelverkauf · Vials · Packungen"),
    image: theme.hub.image
      ? theme.hub.image.startsWith("http") || theme.hub.image.startsWith("/")
        ? theme.hub.image
        : siteDesignImageUrl(theme.hub.image)
      : null,
  };
}

export function ShopAreaShowcase({
  areas,
  heading = "Verkaufsbereiche",
}: {
  areas: readonly MyShopArea[];
  heading?: string;
}) {
  const retail = areas.filter((area) => !isGroupBuyPricing(area.pricing_profile));
  const group = areas.filter((area) => isGroupBuyPricing(area.pricing_profile));
  const featured = retail[0] ?? group[0] ?? null;
  const rest = areas.filter((area) => area.key !== featured?.key);

  if (!featured) return null;

  return (
    <section className="space-y-5">
      <div>
        <p className={UI_TYPE.eyebrow}>PEPTIX</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <FeaturedArea area={featured} className="lg:col-span-7" />
        <div className="flex flex-col gap-4 lg:col-span-5">
          {rest.map((area) => (
            <StackedArea key={area.key} area={area} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedArea({ area, className }: { area: MyShopArea; className?: string }) {
  const copy = areaCopy(area);

  return (
    <Link
      to={area.path}
      className={cn(
        "group relative flex min-h-[22rem] flex-col justify-end overflow-hidden border border-primary/20 bg-secondary/20",
        className,
      )}
    >
      {copy.image ? (
        <img src={copy.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_0%_100%,hsl(var(--primary)/0.18),transparent_58%)]"
        />
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
      <span className="absolute left-0 top-0 h-full w-px bg-primary/50" />
      <div className="relative z-10 flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-primary">
          <AreaGlyph iconKey={area.icon_key} className="h-5 w-5" />
          <span className={UI_TYPE.status}>{copy.isGb ? "Group Buy" : "Retail"}</span>
        </div>
        <h3 className="font-display text-3xl font-semibold leading-[0.95] tracking-tight sm:text-4xl">{copy.title}</h3>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{copy.subtitle}</p>
        {area.badge_text ? <Badge variant="secondary" className="w-fit">{area.badge_text}</Badge> : null}
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          {area.status === "coming_soon" ? "Bald verfügbar" : "Bereich öffnen"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function StackedArea({ area }: { area: MyShopArea }) {
  const copy = areaCopy(area);

  return (
    <Link
      to={area.path}
      className="group relative flex min-h-[10.5rem] flex-1 flex-col justify-between overflow-hidden border border-border/80 bg-card/40 p-5"
    >
      {copy.image ? (
        <img src={copy.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      ) : copy.isGb ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_240px_at_100%_0%,hsl(var(--warning)/0.12),transparent_60%)]"
        />
      ) : null}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
          <AreaGlyph iconKey={area.icon_key} className="h-4 w-4" />
        </span>
        <span className={cn(UI_TYPE.status, copy.isGb ? "text-warning" : "text-muted-foreground")}>
          {copy.isGb ? "Kits" : "Einzel"}
        </span>
      </div>
      <div className="relative z-10">
        <h3 className="font-display text-xl font-semibold tracking-tight">{copy.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>
    </Link>
  );
}

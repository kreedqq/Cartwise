import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PAGE_BLEED, PAGE_BLEED_PAD, UI_TYPE } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

export function KitMarketplaceHero({
  areaName,
  description,
  actions,
}: {
  areaName: string;
  description?: string | null;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        PAGE_BLEED,
        "-mt-8 lg:-mt-10",
        "relative overflow-hidden max-md:border-b-0 md:border-b md:border-warning/25",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 max-md:opacity-40 md:opacity-100 bg-[radial-gradient(720px_320px_at_100%_0%,hsl(var(--warning)/0.16),transparent_55%)]"
      />
      <div className={cn(PAGE_BLEED_PAD, "relative grid gap-4 py-4 max-md:py-3 md:gap-8 md:py-10 lg:grid-cols-12 lg:py-12")}>
        <div className="lg:col-span-8">
          <p className={UI_TYPE.eyebrow}>Group Buy · {areaName}</p>
          <h1 className="mt-2 max-w-3xl font-display text-lg font-semibold leading-tight tracking-tight max-md:line-clamp-2 md:mt-3 md:text-[clamp(2rem,4.6vw,3.75rem)] md:leading-[0.94]">
            <span className="md:hidden">Kits teilen · nur deinen Anteil zahlen</span>
            <span className="hidden md:inline">
              Teile ein Kit.
              <br />
              Zahle nur deinen Anteil.
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground max-md:line-clamp-2 md:mt-4 md:text-base">
            {description?.trim() || "Offene Gesuche anderer Kunden. Der Fortschritt kommt aus echten Zuteilungen."}
          </p>
          {actions ? <div className="mt-3 max-md:mt-2 md:mt-6">{actions}</div> : null}
        </div>
        <div className="hidden flex-col justify-end md:flex lg:col-span-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            9/10 bedeutet: neun Anteile sind vergeben, ein Platz ist frei. Keine erfundenen Knappheiten.
          </p>
          <Button asChild variant="link" className="mt-3 h-auto justify-start px-0 text-primary">
            <Link to="/shop">Zum Retail Shop</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

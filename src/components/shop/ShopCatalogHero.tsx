import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PAGE_BLEED_PAD, PAGE_BLEED_TOP, UI_TYPE } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

interface ShopCatalogHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
  /** Less vertical padding for Shop Hub / category landing. */
  compact?: boolean;
}

export function ShopCatalogHero({
  eyebrow = "PEPTIX",
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Produkte, Varianten oder Kategorien suchen …",
  className,
  compact = false,
}: ShopCatalogHeroProps) {
  return (
    <section
      className={cn(
        PAGE_BLEED_TOP,
        "relative overflow-hidden border-b border-primary/15",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_320px_at_70%_-10%,hsl(var(--primary)/0.16),transparent_60%),radial-gradient(600px_240px_at_10%_100%,hsl(var(--primary)/0.08),transparent_55%)]"
      />
      <div className={cn(PAGE_BLEED_PAD, "relative", compact ? "py-5 lg:py-6" : "py-8 lg:py-10")}>
        <p className={UI_TYPE.eyebrow}>{eyebrow}</p>
        <h1
          className={cn(
            "mt-1.5 max-w-3xl font-display font-semibold leading-[0.95] tracking-tight",
            compact ? "text-[clamp(1.5rem,3.5vw,2.25rem)]" : "mt-2 text-[clamp(1.75rem,4vw,2.85rem)]",
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
        {onSearchChange ? (
          <div className="relative mt-5 max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 border-border/50 bg-background/60 pl-10 text-sm backdrop-blur-sm"
              aria-label="Katalog durchsuchen"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

import { Droplets, FlaskConical, Package, Pill, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { storefrontHeadline, type AreaCategory } from "@/lib/shop/areaCategories";
import { cn } from "@/lib/utils";

const KNOWN_ICONS: Record<string, LucideIcon> = {
  peptides: FlaskConical,
  "injectable-oils": Droplets,
  orals: Pill,
  "reconstitution-water": Waves,
};

/** Compact category discovery — no oversized empty tiles. */
export function ShopCategoryHub({
  categories,
  counts,
  onSelect,
}: {
  categories: readonly AreaCategory[];
  counts: Record<string, number> | null;
  onSelect: (key: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Kategorien</p>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = KNOWN_ICONS[category.category_key] ?? Package;
          const count = counts?.[category.category_key];
          return (
            <button
              key={category.category_key}
              type="button"
              onClick={() => onSelect(category.category_key)}
              className={cn(
                "group inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border/50",
                "bg-gradient-to-br from-card/50 to-background/30 px-4 py-2 text-left transition-colors",
                "hover:border-primary/45 hover:from-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 truncate text-sm font-semibold tracking-tight">
                {storefrontHeadline(category.label)}
              </span>
              {typeof count === "number" ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

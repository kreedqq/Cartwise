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

export function ShopCategoryHub({
  categories,
  counts,
  onSelect,
}: {
  categories: readonly AreaCategory[];
  counts: Record<string, number> | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {categories.map((category) => {
        const Icon = KNOWN_ICONS[category.category_key] ?? Package;
        const count = counts?.[category.category_key];
        return (
          <button
            key={category.category_key}
            type="button"
            onClick={() => onSelect(category.category_key)}
            className={cn(
              "group relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-7 text-left transition-colors duration-200",
              "hover:border-primary/45 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-70" />
            <Icon className="h-6 w-6 text-primary" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Katalog</p>
              <p className="mt-2 font-display text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-3xl">
                {storefrontHeadline(category.label)}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {count != null ? `${count} Artikel` : "Artikel"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

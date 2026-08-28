import { Droplets, FlaskConical, Pill, Waves } from "lucide-react";

import { SHOP_CATEGORIES, type ShopCategoryId } from "@/lib/shopCategories";
import { cn } from "@/lib/utils";

const ICONS = {
  peptides: FlaskConical,
  "injectable-oils": Droplets,
  orals: Pill,
  "reconstitution-water": Waves,
} as const;

export function ShopCategoryHub({
  counts,
  onSelect,
}: {
  counts: Record<ShopCategoryId, number> | null;
  onSelect: (id: ShopCategoryId) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {SHOP_CATEGORIES.map((category) => {
        const Icon = ICONS[category.id];
        const count = counts?.[category.id];
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
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
                {category.headline}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {category.description}
                {count != null ? ` · ${count} Artikel` : ""}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

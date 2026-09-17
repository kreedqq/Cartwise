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
  const [featured, ...rest] = categories;
  if (!featured) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <CategoryTile
        category={featured}
        count={counts?.[featured.category_key]}
        onSelect={onSelect}
        featured
        className="lg:col-span-7"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
        {rest.map((category) => (
          <CategoryTile
            key={category.category_key}
            category={category}
            count={counts?.[category.category_key]}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryTile({
  category,
  count,
  onSelect,
  featured = false,
  className,
}: {
  category: AreaCategory;
  count: number | undefined;
  onSelect: (key: string) => void;
  featured?: boolean;
  className?: string;
}) {
  const Icon = KNOWN_ICONS[category.category_key] ?? Package;
  return (
    <button
      type="button"
      onClick={() => onSelect(category.category_key)}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden border border-border/80 bg-card/30 text-left transition-colors",
        "hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        featured ? "min-h-[18rem] p-7 sm:p-8" : "min-h-[8.5rem] p-5",
        className,
      )}
    >
      <span className="absolute left-0 top-0 h-full w-px bg-primary/40 opacity-70" />
      <Icon className={cn("text-primary", featured ? "h-7 w-7" : "h-5 w-5")} />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Katalog</p>
        <p
          className={cn(
            "mt-2 font-display font-semibold leading-tight tracking-tight",
            featured ? "text-[1.85rem] sm:text-4xl" : "text-xl",
          )}
        >
          {storefrontHeadline(category.label)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{count != null ? `${count} Artikel` : "Artikel"}</p>
      </div>
    </button>
  );
}

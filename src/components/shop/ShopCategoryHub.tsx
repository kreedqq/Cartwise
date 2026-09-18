import { Droplets, FlaskConical, Package, Pill, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ShopCategoryPortal } from "@/components/shop/ShopCategoryPortal";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { storefrontHeadline, type AreaCategory } from "@/lib/shop/areaCategories";
import { resolvePortalAccent } from "@/lib/shop/portalTheme";

const KNOWN_ICONS: Record<string, LucideIcon> = {
  peptides: FlaskConical,
  "injectable-oils": Droplets,
  orals: Pill,
  "reconstitution-water": Waves,
};

/** Category discovery as cinematic portals (data-driven from area categories). */
export function ShopCategoryHub({
  categories,
  counts,
  onSelect,
}: {
  categories: readonly AreaCategory[];
  counts: Record<string, number> | null;
  onSelect: (key: string) => void;
}) {
  const { theme, portal, portalAccentHex } = useShopAreaContext();
  const accentHex = portalAccentHex || resolvePortalAccent(portal, theme.tokens.accent, theme.tokens.primary);

  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Kategorien</p>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const Icon = KNOWN_ICONS[category.category_key] ?? Package;
          const count = counts?.[category.category_key];
          return (
            <ShopCategoryPortal
              key={category.category_key}
              title={storefrontHeadline(category.label)}
              productCount={count}
              onSelect={() => onSelect(category.category_key)}
              accentHex={accentHex}
              glow={Math.max(35, portal.glow - 10)}
              atmosphere={portal.atmosphere}
              icon={<Icon className="h-4 w-4" aria-hidden />}
            />
          );
        })}
      </div>
    </div>
  );
}

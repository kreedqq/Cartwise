import { ShopPortalAtmosphere } from "@/components/shop/ShopPortalAtmosphere";
import { UI_TYPE } from "@/lib/design/tokens";
import type { PortalAtmosphere } from "@/lib/shop/portalTheme";
import { cn } from "@/lib/utils";

export function ShopCategoryPortal({
  title,
  productCount,
  onSelect,
  accentHex,
  glow = 45,
  atmosphere = "energy",
  portalAssetUrl,
  categoryKey,
  icon: _icon,
}: {
  title: string;
  categoryKey?: string;
  productCount?: number;
  onSelect: () => void;
  accentHex: string;
  glow?: number;
  atmosphere?: PortalAtmosphere;
  portalAssetUrl?: string | null;
  /** Optional — portal artwork is primary; icon not shown in chrome */
  icon?: React.ReactNode;
}) {
  const ariaLabel =
    typeof productCount === "number"
      ? `${title} — ${productCount} ${productCount === 1 ? "Produkt" : "Produkte"}`
      : `${title} betreten`;

  return (
    <button
      type="button"
      data-testid="shop-category-portal"
      data-category-key={categoryKey}
      onClick={onSelect}
      aria-label={ariaLabel}
      className={cn(
        "group flex w-full flex-col items-center gap-2 rounded-none border-0 bg-transparent p-0 text-center sm:gap-2.5",
        "transition-[transform,filter] duration-200 motion-reduce:transition-none",
        "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-0",
        "focus-visible:[filter:drop-shadow(0_0_16px_color-mix(in_srgb,var(--portal-accent)_50%,transparent))]",
      )}
      style={{ ["--portal-accent" as string]: accentHex }}
    >
      <div className="relative w-full max-w-[min(92vw,20rem)] sm:max-w-[min(88%,21rem)]">
        <ShopPortalAtmosphere
          accentHex={accentHex}
          glow={glow}
          atmosphere={atmosphere}
          portalAssetUrl={portalAssetUrl}
          intensity="gateway"
          presentation="entrance"
        />
      </div>
      <div className="max-w-xs space-y-1 px-1">
        <p className={cn(UI_TYPE.status, "text-[color:var(--portal-accent)]")}>Kategorie</p>
        <p className="font-display text-base font-semibold uppercase leading-tight tracking-tight text-foreground sm:text-lg">
          {title}
        </p>
        {typeof productCount === "number" ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            {productCount} {productCount === 1 ? "Produkt" : "Produkte"}
          </p>
        ) : null}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--portal-accent)] sm:text-xs">
          Entdecken →
        </p>
      </div>
    </button>
  );
}

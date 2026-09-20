import { Check, Heart, Minus, Plus, ShoppingCart } from "lucide-react";

import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShopProductImageFrame } from "@/components/shop/ShopProductImageFrame";
import { ShopProductInfoPopover } from "@/components/shop/ShopProductInfoPopover";
import { useShopProductGroupRow } from "@/hooks/useShopProductGroupRow";
import { SHOP_GRID, UI_TYPE } from "@/lib/design/tokens";
import { SHOP_RETAIL_ADD_CTA } from "@/lib/kitRequests";
import { formatCatalogQuantity } from "@/lib/quantityFormat";
import { variantLabelForProduct, type ShopProductGroup } from "@/lib/shop/display";
import {
  formatRetailVariantLabel,
  retailShopProductTitle,
  shopProductTitle,
  showsStandaloneVariantLabel,
} from "@/lib/shop/variantCoverage";
import type { AreaCategoryAssignment } from "@/lib/shop/areaCategories";
import { effectiveCategoryKeyForProduct } from "@/lib/shop/areaCategories";
import { shopCategoryLabelForKey } from "@/lib/shop/productMedia";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { isShopCategoryId, shopCategoryIdFor } from "@/lib/shopCategories";
import { cn } from "@/lib/utils";

interface ShopProductCardProps {
  group: ShopProductGroup;
  rate: number | null;
  rateLoading?: boolean;
  favoriteProductIds: Set<string>;
  categoryLabel?: string;
  categoryId?: ShopCategoryId;
  areaCategoryKey?: string;
  categoryAssignments?: readonly AreaCategoryAssignment[];
  saleMode: "catalog" | "retail_unit";
  showKitShare: boolean;
  onKitShare: (productId: string) => void;
}

export function ShopProductCard({
  group,
  rate,
  rateLoading = false,
  favoriteProductIds,
  categoryLabel,
  categoryId,
  areaCategoryKey,
  categoryAssignments,
  saleMode,
  showKitShare,
  onKitShare,
}: ShopProductCardProps) {
  const isRetail = saleMode === "retail_unit";
  const row = useShopProductGroupRow(
    group,
    rate,
    favoriteProductIds,
    saleMode,
    categoryId,
    areaCategoryKey,
  );
  const product = row.product;
  const isFavorite = favoriteProductIds.has(product.id);
  const title = isRetail
    ? retailShopProductTitle(group.displayName, product, row.hasMultipleVariants)
    : shopProductTitle(group.displayName, product, row.hasMultipleVariants);
  const effectiveKey =
    (categoryAssignments?.length
      ? effectiveCategoryKeyForProduct(product, categoryAssignments)
      : null) ??
    (categoryId ?? shopCategoryIdFor(product));
  const catId = isShopCategoryId(effectiveKey) ? effectiveKey : categoryId ?? shopCategoryIdFor(product);
  const resolvedCategoryLabel = categoryLabel ?? shopCategoryLabelForKey(effectiveKey);
  const variantLabel = isRetail ? formatRetailVariantLabel(product) : variantLabelForProduct(product);
  const description = product.description?.trim();

  const variantControl = row.hasMultipleVariants ? (
    <Select value={row.selectedProductId} onValueChange={row.setSelectedProductId}>
      <SelectTrigger className="h-8 w-full min-w-0 text-xs" aria-label="Variante wählen">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {group.variants.map((variant) => (
          <SelectItem key={variant.id} value={variant.id} className="text-xs">
            {isRetail ? formatRetailVariantLabel(variant) : variantLabelForProduct(variant)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : showsStandaloneVariantLabel(product, false) ? (
    <p className={cn(UI_TYPE.shopVariant, "truncate text-xs")}>{variantLabel}</p>
  ) : null;

  return (
    <article
      role="listitem"
      className={SHOP_GRID.card}
      data-product-code={product.code}
      data-testid="shop-product-card"
    >
      <ShopProductImageFrame
        product={product}
        categoryKey={effectiveKey}
        categoryLabel={resolvedCategoryLabel}
        favoriteControl={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/40 backdrop-blur-sm hover:bg-background/70 sm:h-9 sm:w-9"
            disabled={row.favoritePending}
            onClick={row.toggleFavorite}
            aria-label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
          >
            <Heart
              className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", isFavorite ? "fill-primary text-primary" : "text-foreground/80")}
              aria-hidden
            />
          </Button>
        }
      />

      <div className={SHOP_GRID.body}>
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <p className={cn(UI_TYPE.shopProduct, "line-clamp-2 text-[14px] leading-snug sm:text-[15px]")}>{title}</p>
            <p className={cn(UI_TYPE.shopCategory, "mt-0.5 hidden truncate uppercase tracking-[0.12em] sm:block")}>
              {categoryLabel ?? product.category ?? "Produkt"}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <ShopProductInfoPopover product={product} displayTitle={title} lexiconHref={group.lexiconHref} />
          </div>
        </div>

        <DualCurrencyPrice usd={product.price_usd} rate={rate} rateLoading={rateLoading} size="card" />

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          {variantControl ? <div className="min-w-0 flex-1">{variantControl}</div> : null}
          <div className={cn(SHOP_GRID.qtyStepper, !variantControl && "sm:max-w-[8.75rem]")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-none"
              onClick={() => row.bumpQuantity(-1)}
              aria-label="Menge verringern"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <span className="min-w-[2.5rem] px-0.5 text-center text-[11px] font-semibold tabular-nums sm:text-xs" aria-live="polite">
              {formatCatalogQuantity(Number(row.quantity.replace(",", ".")), catId, saleMode)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-none"
              onClick={() => row.bumpQuantity(1)}
              aria-label="Menge erhöhen"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        {description ? (
          <p className="hidden line-clamp-1 text-xs leading-relaxed text-muted-foreground md:block">{description}</p>
        ) : null}

        <Button
          type="button"
          className={SHOP_GRID.addBtn}
          variant={row.status === "success" ? "secondary" : "default"}
          loading={row.status === "loading"}
          onClick={row.handleAdd}
        >
          {row.status === "success" ? (
            <Check className="h-4 w-4 text-success" aria-hidden />
          ) : (
            <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="truncate">
            {row.status === "success" ? "OK" : isRetail ? SHOP_RETAIL_ADD_CTA : "In den Warenkorb"}
          </span>
        </Button>

        {showKitShare ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full text-[11px] font-medium text-muted-foreground hover:text-primary sm:text-xs"
            onClick={() => onKitShare(row.selectedProductId)}
          >
            Kit gemeinsam kaufen
          </Button>
        ) : null}
      </div>
    </article>
  );
}

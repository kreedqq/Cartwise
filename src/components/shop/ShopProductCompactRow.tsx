import { Check, Minus, Plus, ShoppingCart, Star } from "lucide-react";

import * as React from "react";

import { Button } from "@/components/ui/button";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";

import { ShopProductInfoPopover } from "@/components/shop/ShopProductInfoPopover";

import { useShopProductGroupRow } from "@/hooks/useShopProductGroupRow";

import { SHOP_CATALOG, UI_TYPE } from "@/lib/design/tokens";

import { formatCatalogQuantity } from "@/lib/quantityFormat";

import { SHOP_RETAIL_ADD_CTA } from "@/lib/kitRequests";

import type { ShopCategoryId } from "@/lib/shopCategories";

import { shopCategoryIdFor } from "@/lib/shopCategories";

import { variantLabelForProduct, type ShopProductGroup } from "@/lib/shop/display";

import {
  formatRetailVariantLabel,
  retailShopProductTitle,
  shopProductTitle,
  showsStandaloneVariantLabel,
} from "@/lib/shop/variantCoverage";

import { cn } from "@/lib/utils";

interface ShopProductCompactRowProps {
  group: ShopProductGroup;

  rate: number | null;

  rateLoading?: boolean;

  favoriteProductIds: Set<string>;

  categoryLabel?: string;

  categoryId?: ShopCategoryId;

  saleMode: "catalog" | "retail_unit";

  showKitShare: boolean;

  onKitShare: (productId: string) => void;
}

function VariantCell({
  row,

  group,

  isRetail,

  variantLabel,

  product,

  className,
}: {
  row: ReturnType<typeof useShopProductGroupRow>;

  group: ShopProductGroup;

  isRetail: boolean;

  variantLabel: string;

  product: ShopProductGroup["variants"][0];

  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {row.hasMultipleVariants ? (
        <Select value={row.selectedProductId} onValueChange={row.setSelectedProductId}>
          <SelectTrigger
            className="h-8 w-full max-w-[14rem] text-xs max-sm:h-9 max-sm:max-w-[9rem]"
            aria-label="Variante wählen"
          >
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
        <p className={cn(UI_TYPE.shopVariant, "max-sm:text-xs max-sm:text-muted-foreground")}>
          {variantLabel}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">—</p>
      )}
    </div>
  );
}

function QtyStepper({
  row,

  catId,

  saleMode,

  compact,
}: {
  row: ReturnType<typeof useShopProductGroupRow>;

  catId: ShopCategoryId;

  saleMode: "catalog" | "retail_unit";

  compact?: boolean;
}) {
  return (
    <div className={SHOP_CATALOG.qtyStepper}>
      <Button
        type="button"

        variant="ghost"

        size="icon"

        className="h-9 w-9 shrink-0 rounded-none"

        onClick={() => row.bumpQuantity(-1)}

        aria-label="Menge verringern"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </Button>

      <span
        className={cn(
          "px-1 text-center text-xs font-semibold tabular-nums",

          compact ? "min-w-[2.75rem]" : "min-w-[3.25rem]",
        )}

        aria-live="polite"
      >
        {formatCatalogQuantity(Number(row.quantity.replace(",", ".")), catId, saleMode)}
      </span>

      <Button
        type="button"

        variant="ghost"

        size="icon"

        className="h-9 w-9 shrink-0 rounded-none"

        onClick={() => row.bumpQuantity(1)}

        aria-label="Menge erhöhen"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function AddButton({
  row,

  isRetail,

  className,

  labelClassName,
}: {
  row: ReturnType<typeof useShopProductGroupRow>;

  isRetail: boolean;

  className?: string;

  labelClassName?: string;
}) {
  return (
    <Button
      type="button"

      className={cn(SHOP_CATALOG.addBtn, className)}

      variant={row.status === "success" ? "secondary" : "default"}

      loading={row.status === "loading"}
      onClick={row.handleAdd}
      aria-label={row.status === "success" ? "Hinzugefügt" : isRetail ? SHOP_RETAIL_ADD_CTA : "Hinzufügen"}
    >
      {row.status === "success" ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <ShoppingCart className="h-4 w-4" aria-hidden />
      )}

      <span className={labelClassName}>
        {row.status === "success" ? "OK" : isRetail ? SHOP_RETAIL_ADD_CTA : "Hinzufügen"}
      </span>
    </Button>
  );
}

export function ShopProductCompactRow({
  group,

  rate,

  rateLoading = false,

  favoriteProductIds,

  categoryLabel,

  categoryId,

  saleMode,

  showKitShare,

  onKitShare,
}: ShopProductCompactRowProps) {
  const isRetail = saleMode === "retail_unit";

  const row = useShopProductGroupRow(group, rate, favoriteProductIds, saleMode, categoryId);

  const product = row.product;

  const isFavorite = favoriteProductIds.has(product.id);

  const title = isRetail
    ? retailShopProductTitle(group.displayName, product, row.hasMultipleVariants)
    : shopProductTitle(group.displayName, product, row.hasMultipleVariants);

  const catId = categoryId ?? shopCategoryIdFor(product);

  const variantLabel = isRetail ? formatRetailVariantLabel(product) : variantLabelForProduct(product);

  return (
    <article role="listitem" className={cn(SHOP_CATALOG.row, "group/row")} data-product-code={product.code}>
      {/* PRODUCT */}

      <div className="min-w-0 max-sm:col-start-1 max-sm:row-start-1">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <p className={UI_TYPE.shopProduct}>{title}</p>

            <p className={UI_TYPE.shopCategory}>
              {categoryLabel ?? product.category ?? (isRetail ? product.code : "Produkt")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 opacity-80 sm:opacity-60 sm:group-hover/row:opacity-100">
            <Button
              type="button"

              variant="ghost"

              size="icon"

              className="h-8 w-8"

              disabled={row.favoritePending}

              onClick={row.toggleFavorite}

              aria-label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",

                  isFavorite ? "fill-warning text-warning" : "text-muted-foreground",
                )}

                aria-hidden
              />
            </Button>

            <ShopProductInfoPopover product={product} displayTitle={title} lexiconHref={group.lexiconHref} />
          </div>
        </div>

        {showKitShare ? (
          <Button
            type="button"

            variant="ghost"

            size="sm"

            className="mt-1 hidden h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-primary sm:inline-flex"

            onClick={() => onKitShare(row.selectedProductId)}
          >
            Kit teilen
          </Button>
        ) : null}
      </div>

      {/* VARIANT — desktop grid column */}

      <div className="hidden min-w-0 sm:block">
        <VariantCell
          row={row}
          group={group}
          isRetail={isRetail}
          variantLabel={variantLabel}
          product={product}
        />
      </div>

      {/* PRICE — mobile top-right; desktop column */}

      <div className="max-sm:col-start-2 max-sm:row-start-1 max-sm:text-right sm:tabular-nums">
        <DualCurrencyPrice
          usd={product.price_usd}

          rate={rate}

          rateLoading={rateLoading}

          size="compact"

          align="right"

          className="sm:text-left"
        />
      </div>

      {/* QUANTITY — desktop */}

      <div className="hidden sm:block">
        <QtyStepper row={row} catId={catId} saleMode={saleMode} />
      </div>

      {/* PRIMARY ACTION — desktop */}

      <div className="hidden sm:flex sm:items-center">
        <AddButton row={row} isRetail={isRetail} />
      </div>

      {/* Mobile: variant + qty + CTA */}

      <div className="col-span-2 flex min-w-0 items-center gap-2 max-sm:col-start-1 max-sm:row-start-2 sm:hidden">
        <VariantCell
          row={row}

          group={group}

          isRetail={isRetail}

          variantLabel={variantLabel}

          product={product}

          className="min-w-0 flex-1"
        />

        <QtyStepper row={row} catId={catId} saleMode={saleMode} compact />

        <AddButton
          row={row}
          isRetail={isRetail}
          className="max-sm:min-h-11 max-sm:min-w-11 max-sm:shrink-0 max-sm:px-2.5"
          labelClassName="sr-only"
        />
      </div>
    </article>
  );
}

import { Check, Info, ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateKitRequestDialog } from "@/components/kit-requests/CreateKitRequestDialog";
import { KitShareButton } from "@/components/shop/KitShareDialog";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { useShopProductGroupRow } from "@/hooks/useShopProductGroupRow";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { formatQuantity, hasBulkTier } from "@/lib/money";
import { formatCatalogQuantity } from "@/lib/quantityFormat";
import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";
import { isRetailPricing, type ShopPricingProfile } from "@/lib/shop/shopAreas";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { shopCategoryIdFor } from "@/lib/shopCategories";
import {
  groupAndSortShopProducts,
  shopQuantityOptions,
  variantLabelForProduct,
  type ShopProductGroup,
} from "@/lib/shop/display";
import {
  formatRetailVariantLabel,
  retailShopProductTitle,
  shopProductTitle,
  showsStandaloneVariantLabel,
} from "@/lib/shop/variantCoverage";
import { useQuantityDiscountsEnabled } from "@/hooks/useAppPublicState";
import type { Tables } from "@/types/database";

interface ShopProductsMobileListProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
  categoryId?: ShopCategoryId;
  pricingProfile?: ShopPricingProfile;
  onKitCreated?: (id: string) => void;
}

export function ShopProductsMobileList({
  products,
  rate,
  favoriteProductIds,
  categoryId,
  pricingProfile = "group_buy",
  onKitCreated,
}: ShopProductsMobileListProps) {
  const { shopArea } = useShopAreaContext();
  const quantityDiscountsEnabled = useQuantityDiscountsEnabled();
  const groups = groupAndSortShopProducts(products);
  const priceLabels = shopPriceColumnLabels(
    categoryId ?? shopCategoryIdFor(products[0] ?? { category: null, name: "", code: "" }),
    pricingProfile,
  );
  const saleMode = isRetailPricing(pricingProfile) ? "retail_unit" : "catalog";
  const showKitShare = !isRetailPricing(pricingProfile);
  const showBulkColumn = !isRetailPricing(pricingProfile) && quantityDiscountsEnabled;
  const [kitProductId, setKitProductId] = React.useState<string | null>(null);

  return (
    <>
      <div className="space-y-3">
        {groups.map((group) => (
          <ShopProductGroupCard
            key={group.groupKey}
            group={group}
            rate={rate}
            favoriteProductIds={favoriteProductIds}
            priceLabels={priceLabels}
            saleMode={saleMode}
            showBulkColumn={showBulkColumn}
            showKitShare={showKitShare}
            onKitShare={(productId) => setKitProductId(productId)}
          />
        ))}
      </div>
      {showKitShare && kitProductId ? (
        <CreateKitRequestDialog
          key={kitProductId}
          shopArea={shopArea}
          initialProductId={kitProductId}
          open
          onOpenChange={(open) => {
            if (!open) setKitProductId(null);
          }}
          onCreated={(id) => {
            setKitProductId(null);
            onKitCreated?.(id);
          }}
        />
      ) : null}
    </>
  );
}

function ShopProductGroupCard({
  group,
  rate,
  favoriteProductIds,
  priceLabels,
  saleMode,
  showBulkColumn,
  showKitShare,
  onKitShare,
}: {
  group: ShopProductGroup;
  rate: number | null;
  favoriteProductIds: Set<string>;
  priceLabels: ReturnType<typeof shopPriceColumnLabels>;
  saleMode: "catalog" | "retail_unit";
  showBulkColumn: boolean;
  showKitShare: boolean;
  onKitShare: (productId: string) => void;
}) {
  const row = useShopProductGroupRow(group, rate, favoriteProductIds);
  const product = row.product;

  const bulk = hasBulkTier(product);
  const qtyNum = Number(row.quantity.replace(",", "."));
  const bulkActive = bulk && Number.isFinite(qtyNum) && qtyNum >= (product.bulk_price_min_quantity as number);
  const remaining =
    bulk && Number.isFinite(qtyNum) && !bulkActive
      ? Math.max(0, (product.bulk_price_min_quantity as number) - qtyNum)
      : null;
  const isFavorite = favoriteProductIds.has(product.id);
  const isRetail = saleMode === "retail_unit";
  const title = isRetail
    ? retailShopProductTitle(group.displayName, product, row.hasMultipleVariants)
    : shopProductTitle(group.displayName, product, row.hasMultipleVariants);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <div className="flex shrink-0 items-center gap-0.5">
            {group.lexiconHref ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Zum Lexikon">
                <Link to={group.lexiconHref} aria-label="Zum Lexikon">
                  <Info className="h-4 w-4 text-primary" />
                </Link>
              </Button>
            ) : (
              <span className="inline-flex h-8 w-8 items-center justify-center" aria-hidden="true" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={row.favoritePending}
              onClick={row.toggleFavorite}
              aria-label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
            >
              <Star className={isFavorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4 text-muted-foreground"} />
            </Button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{title}</p>
            {row.hasMultipleVariants ? (
              <Select value={row.selectedProductId} onValueChange={row.setSelectedProductId}>
                <SelectTrigger className="mt-2 h-10 w-full" aria-label="Variante wählen">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {group.variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {isRetail ? formatRetailVariantLabel(variant) : variantLabelForProduct(variant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : showsStandaloneVariantLabel(product, false) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {isRetail ? formatRetailVariantLabel(product) : variantLabelForProduct(product)}
              </p>
            ) : null}
            {showKitShare && (
            <div className="mt-2">
              <KitShareButton
                group={group}
                selectedProductId={row.selectedProductId}
                onClick={() => onKitShare(row.selectedProductId)}
              />
            </div>
            )}
          </div>
        </div>

        <div className={showBulkColumn ? "grid grid-cols-2 gap-2 rounded-md bg-secondary/50 p-2.5 text-sm" : "rounded-md bg-secondary/50 p-2.5 text-sm"}>
          <div>
            <p className="text-[11px] text-muted-foreground">{priceLabels.unitPrice}</p>
            <DualCurrencyPrice usd={product.price_usd} rate={rate} />
          </div>
          {showBulkColumn ? (
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">{priceLabels.bulkPrice}</p>
            {bulk ? (
              <>
                <DualCurrencyPrice usd={product.bulk_price_usd} rate={rate} align="right" />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Keiner</p>
            )}
          </div>
          ) : null}
        </div>

        {showBulkColumn && bulk && (bulkActive || (remaining != null && remaining > 0)) && (
          <p className={bulkActive ? "text-xs font-medium text-success" : "text-xs text-muted-foreground"}>
            {bulkActive ? priceLabels.bulkActive : priceLabels.bulkRemaining(formatQuantity(remaining!))}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Select value={row.quantity} onValueChange={row.setQuantity}>
            <SelectTrigger className="h-11 w-full" aria-label="Menge wählen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shopQuantityOptions(shopCategoryIdFor(product), saleMode).map((qty) => (
                <SelectItem key={qty} value={String(qty)}>
                  {formatCatalogQuantity(qty, shopCategoryIdFor(product), saleMode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="min-h-11 w-full"
            variant={row.status === "success" ? "secondary" : "default"}
            loading={row.status === "loading"}
            onClick={row.handleAdd}
          >
            {row.status === "success" ? <Check className="text-success" /> : <ShoppingCart />}
            {row.status === "success" ? "Hinzugefügt" : "In den Warenkorb"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

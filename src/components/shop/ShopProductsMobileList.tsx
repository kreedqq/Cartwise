import { Check, Info, ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KitShareButton, KitShareDialog } from "@/components/shop/KitShareDialog";
import { useShopProductGroupRow } from "@/hooks/useShopProductGroupRow";
import { convertUsdToEur, formatEur, formatQuantity, formatUsd, hasBulkTier } from "@/lib/money";
import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { shopCategoryIdFor } from "@/lib/shopCategories";
import {
  groupAndSortShopProducts,
  SHOP_QUANTITY_OPTIONS,
  variantLabelForProduct,
  type ShopProductGroup,
} from "@/lib/shop/display";
import { shopProductTitle, showsStandaloneVariantLabel } from "@/lib/shop/variantCoverage";
import { listKitShareMembers } from "@/services/kitShareMembers";
import type { Tables } from "@/types/database";

interface ShopProductsMobileListProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
  categoryId?: ShopCategoryId;
}

export function ShopProductsMobileList({ products, rate, favoriteProductIds, categoryId }: ShopProductsMobileListProps) {
  const groups = groupAndSortShopProducts(products);
  const priceLabels = shopPriceColumnLabels(
    categoryId ?? shopCategoryIdFor(products[0] ?? { category: null, name: "", code: "" }),
  );
  const [kitShareContext, setKitShareContext] = React.useState<{
    group: ShopProductGroup;
    initialProductId: string;
  } | null>(null);
  const membersQuery = useQuery({
    queryKey: ["kit-share-members"],
    queryFn: listKitShareMembers,
    enabled: kitShareContext != null,
    staleTime: 60_000,
  });

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
            onKitShare={({ group, initialProductId }) => setKitShareContext({ group, initialProductId })}
          />
        ))}
      </div>
      {kitShareContext && (
        <KitShareDialog
          key={`${kitShareContext.group.groupKey}-${kitShareContext.initialProductId}`}
          group={kitShareContext.group}
          initialProductId={kitShareContext.initialProductId}
          members={membersQuery.data ?? []}
          membersLoading={membersQuery.isLoading}
          open={kitShareContext != null}
          onOpenChange={(open) => {
            if (!open) setKitShareContext(null);
          }}
          onCartSynced={() => setKitShareContext(null)}
        />
      )}
    </>
  );
}

function ShopProductGroupCard({
  group,
  rate,
  favoriteProductIds,
  priceLabels,
  onKitShare,
}: {
  group: ShopProductGroup;
  rate: number | null;
  favoriteProductIds: Set<string>;
  priceLabels: ReturnType<typeof shopPriceColumnLabels>;
  onKitShare: (context: { group: ShopProductGroup; initialProductId: string }) => void;
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
  const title = shopProductTitle(group.displayName, product, row.hasMultipleVariants);

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
                <SelectTrigger className="mt-2 h-9 w-full min-w-[11rem]" aria-label="Variante wählen">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {group.variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variantLabelForProduct(variant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : showsStandaloneVariantLabel(product, false) ? (
              <p className="mt-1 text-xs text-muted-foreground">{variantLabelForProduct(product)}</p>
            ) : null}
            <div className="mt-2">
              <KitShareButton
                group={group}
                selectedProductId={row.selectedProductId}
                onClick={() => onKitShare({ group, initialProductId: row.selectedProductId })}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md bg-secondary/50 p-2.5 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">{priceLabels.unitPrice}</p>
            <p className="text-base font-semibold tabular-nums tracking-tight">{formatUsd(product.price_usd)}</p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {formatEur(convertUsdToEur(product.price_usd, rate))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">{priceLabels.bulkPrice}</p>
            {bulk ? (
              <>
                <p className="text-base font-semibold tabular-nums tracking-tight">{formatUsd(product.bulk_price_usd)}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Keiner</p>
            )}
          </div>
        </div>

        {bulk && (bulkActive || (remaining != null && remaining > 0)) && (
          <p className={bulkActive ? "text-xs font-medium text-success" : "text-xs text-muted-foreground"}>
            {bulkActive ? priceLabels.bulkActive : priceLabels.bulkRemaining(formatQuantity(remaining!))}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Select value={row.quantity} onValueChange={row.setQuantity}>
            <SelectTrigger className="h-10 w-[96px] shrink-0" aria-label="Menge wählen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHOP_QUANTITY_OPTIONS.map((qty) => (
                <SelectItem key={qty} value={String(qty)}>
                  {formatQuantity(qty)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            variant={row.status === "success" ? "secondary" : "default"}
            loading={row.status === "loading"}
            onClick={row.handleAdd}
            aria-label={`${group.displayName} zum Warenkorb hinzufügen`}
          >
            {row.status === "success" ? <Check className="text-success" /> : <ShoppingCart />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

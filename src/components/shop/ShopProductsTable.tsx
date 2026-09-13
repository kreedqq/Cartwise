import { Check, Info, ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import * as React from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface ShopProductsTableProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
  categoryId?: ShopCategoryId;
  categoryLabel?: string;
  pricingProfile?: ShopPricingProfile;
  onKitCreated?: (id: string) => void;
}

export function ShopProductsTable({
  products,
  rate,
  favoriteProductIds,
  categoryId,
  categoryLabel,
  pricingProfile = "group_buy",
  onKitCreated,
}: ShopProductsTableProps) {
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
      <div className="rounded-2xl border border-border/80 bg-card/90 p-2 shadow-sm lg:p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20 px-4">Info</TableHead>
              <TableHead className="min-w-[16rem] px-4">Produkt</TableHead>
              <TableHead className="min-w-[12rem] px-4">Variante</TableHead>
              <TableHead className="min-w-[9rem] px-4">{priceLabels.unitPrice}</TableHead>
              {showBulkColumn ? <TableHead className="min-w-[10rem] px-4">{priceLabels.bulkPrice}</TableHead> : null}
              <TableHead className="w-40 px-4 text-right">Menge</TableHead>
              <TableHead className="w-48 px-4 text-right">Warenkorb</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <ShopProductGroupTableRow
                key={group.groupKey}
                group={group}
                rate={rate}
                favoriteProductIds={favoriteProductIds}
                priceLabels={priceLabels}
                saleMode={saleMode}
                showBulkColumn={showBulkColumn}
                showKitShare={showKitShare}
                categoryLabel={categoryLabel}
                onKitShare={(productId) => setKitProductId(productId)}
              />
            ))}
          </TableBody>
        </Table>
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

function ShopProductGroupTableRow({
  group,
  rate,
  favoriteProductIds,
  priceLabels,
  saleMode,
  showBulkColumn,
  showKitShare,
  categoryLabel,
  onKitShare,
}: {
  group: ShopProductGroup;
  rate: number | null;
  favoriteProductIds: Set<string>;
  priceLabels: ReturnType<typeof shopPriceColumnLabels>;
  saleMode: "catalog" | "retail_unit";
  showBulkColumn: boolean;
  showKitShare: boolean;
  categoryLabel?: string;
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
    <TableRow>
      <TableCell className="px-4 py-4">
        <div className="flex items-center gap-0.5">
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
      </TableCell>
      <TableCell className="px-4 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          {categoryLabel ? <p className="text-[11px] text-muted-foreground">{categoryLabel}</p> : null}
          {showKitShare && (
            <KitShareButton
              group={group}
              selectedProductId={row.selectedProductId}
              onClick={() => onKitShare(row.selectedProductId)}
            />
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-4">
        {row.hasMultipleVariants ? (
          <Select value={row.selectedProductId} onValueChange={row.setSelectedProductId}>
            <SelectTrigger className="h-10 w-full min-w-[11rem]" aria-label="Variante wählen">
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
          <p className="text-sm text-muted-foreground">
            {isRetail ? formatRetailVariantLabel(product) : variantLabelForProduct(product)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </TableCell>
      <TableCell className="px-4 py-4 text-sm">
        <DualCurrencyPrice usd={product.price_usd} rate={rate} />
      </TableCell>
      {showBulkColumn ? (
      <TableCell className="px-4 py-4 text-sm">
        {bulk ? (
          <>
            <DualCurrencyPrice usd={product.bulk_price_usd} rate={rate} />
            {bulkActive ? (
              <p className="mt-0.5 text-[11px] font-medium text-success">{priceLabels.bulkActive}</p>
            ) : remaining != null && remaining > 0 ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {priceLabels.bulkRemaining(formatQuantity(remaining))}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{priceLabels.noBulk}</p>
        )}
      </TableCell>
      ) : null}
      <TableCell className="px-4 py-4">
        <Select value={row.quantity} onValueChange={row.setQuantity}>
          <SelectTrigger className="ml-auto h-10 min-w-[10rem] w-[10rem]" aria-label="Menge wählen">
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
      </TableCell>
      <TableCell className="px-4 py-4 text-right">
        <Button
          className="min-h-10 min-w-[10.5rem]"
          variant={row.status === "success" ? "secondary" : "default"}
          loading={row.status === "loading"}
          onClick={row.handleAdd}
        >
          {row.status === "success" ? <Check className="text-success" /> : <ShoppingCart />}
          {row.status === "success" ? "Hinzugefügt" : "In den Warenkorb"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

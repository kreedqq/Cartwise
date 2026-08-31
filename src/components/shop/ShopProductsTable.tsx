import { Check, Info, ShoppingCart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { shopCategoryById, shopCategoryIdFor } from "@/lib/shopCategories";
import {
  groupAndSortShopProducts,
  SHOP_QUANTITY_OPTIONS,
  variantLabelForProduct,
  type ShopProductGroup,
} from "@/lib/shop/display";
import { shopProductTitle, showsStandaloneVariantLabel } from "@/lib/shop/variantCoverage";
import { listKitShareMembers } from "@/services/kitShareMembers";
import type { Tables } from "@/types/database";

interface ShopProductsTableProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
  categoryId?: ShopCategoryId;
}

export function ShopProductsTable({ products, rate, favoriteProductIds, categoryId }: ShopProductsTableProps) {
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Info</TableHead>
            <TableHead className="min-w-[240px]">Produkt</TableHead>
            <TableHead className="w-44">{priceLabels.unitPrice}</TableHead>
            <TableHead className="w-48">{priceLabels.bulkPrice}</TableHead>
            <TableHead className="w-28 text-right">Menge</TableHead>
            <TableHead className="w-16 text-right">In den Warenkorb</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <ShopProductGroupTableRow
              key={group.familySlug}
              group={group}
              rate={rate}
              favoriteProductIds={favoriteProductIds}
              priceLabels={priceLabels}
              onKitShare={({ group, initialProductId }) => setKitShareContext({ group, initialProductId })}
            />
          ))}
        </TableBody>
      </Table>
      {kitShareContext && (
        <KitShareDialog
          key={`${kitShareContext.group.familySlug}-${kitShareContext.initialProductId}`}
          group={kitShareContext.group}
          initialProductId={kitShareContext.initialProductId}
          members={membersQuery.data ?? []}
          membersLoading={membersQuery.isLoading}
          open={kitShareContext != null}
          onOpenChange={(open) => {
            if (!open) setKitShareContext(null);
          }}
          onCartSynced={() => {
            setKitShareContext(null);
          }}
        />
      )}
    </>
  );
}

function ShopProductGroupTableRow({
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
    <TableRow>
      <TableCell>
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
      <TableCell>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {row.hasMultipleVariants ? (
            <Select value={row.selectedProductId} onValueChange={row.setSelectedProductId}>
              <SelectTrigger className="h-9 min-w-[11rem] w-auto max-w-full shrink-0" aria-label="Variante wählen">
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
            <p className="text-xs text-muted-foreground">{variantLabelForProduct(product)}</p>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-muted-foreground">{shopCategoryById(shopCategoryIdFor(product)).label}</p>
          <KitShareButton
            group={group}
            selectedProductId={row.selectedProductId}
            onClick={() => onKitShare({ group, initialProductId: row.selectedProductId })}
          />
        </div>
      </TableCell>
      <TableCell className="text-sm">
        <p className="text-base font-semibold tabular-nums tracking-tight">{formatUsd(product.price_usd)}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{formatEur(convertUsdToEur(product.price_usd, rate))}</p>
      </TableCell>
      <TableCell className="text-sm">
        {bulk ? (
          <>
            <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">
              {formatUsd(product.bulk_price_usd)}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatEur(convertUsdToEur(product.bulk_price_usd as number, rate))}
            </p>
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
      <TableCell>
        <Select value={row.quantity} onValueChange={row.setQuantity}>
          <SelectTrigger className="ml-auto h-9 w-[88px]" aria-label="Menge wählen">
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
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="icon"
          variant={row.status === "success" ? "secondary" : "default"}
          loading={row.status === "loading"}
          onClick={row.handleAdd}
          aria-label={`${group.displayName} zum Warenkorb hinzufügen`}
        >
          {row.status === "success" ? <Check className="text-success" /> : <ShoppingCart />}
        </Button>
      </TableCell>
    </TableRow>
  );
}

import { Check, ShoppingCart, Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useShopProductRow } from "@/hooks/useShopProductRow";
import { convertUsdToEur, formatEur, formatQuantity, formatUsd, hasBulkTier } from "@/lib/money";
import type { Tables } from "@/types/database";

interface ShopProductsMobileListProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
}

export function ShopProductsMobileList({ products, rate, favoriteProductIds }: ShopProductsMobileListProps) {
  return (
    <div className="space-y-3">
      {products.map((product) => (
        <ShopProductCard
          key={product.id}
          product={product}
          rate={rate}
          isFavorite={favoriteProductIds.has(product.id)}
        />
      ))}
    </div>
  );
}

function ShopProductCard({
  product,
  rate,
  isFavorite,
}: {
  product: Tables<"products">;
  rate: number | null;
  isFavorite: boolean;
}) {
  const row = useShopProductRow(product, rate, isFavorite);
  const bulk = hasBulkTier(product);
  const qtyNum = Number(row.quantity.replace(",", "."));
  const bulkActive = bulk && Number.isFinite(qtyNum) && qtyNum >= (product.bulk_price_min_quantity as number);
  const remaining =
    bulk && Number.isFinite(qtyNum) && !bulkActive
      ? Math.max(0, (product.bulk_price_min_quantity as number) - qtyNum)
      : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{product.code}</p>
            <p className="truncate text-sm font-semibold">{product.name}</p>
            {product.dosage_vial && <p className="text-xs text-muted-foreground">{product.dosage_vial}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={row.favoritePending}
            onClick={row.toggleFavorite}
            aria-label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
          >
            <Star className={isFavorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4 text-muted-foreground"} />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md bg-secondary/50 p-2.5 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Einzelpreis</p>
            <p className="text-base font-semibold tabular-nums tracking-tight">{formatUsd(product.price_usd)}</p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {formatEur(convertUsdToEur(product.price_usd, rate))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Mengenpreis</p>
            {bulk ? (
              <>
                <p className="text-base font-semibold tabular-nums tracking-tight">{formatUsd(product.bulk_price_usd)}</p>
                <p className="text-[11px] text-muted-foreground">ab {formatQuantity(product.bulk_price_min_quantity)}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Keiner</p>
            )}
          </div>
        </div>

        {bulk && (bulkActive || (remaining != null && remaining > 0)) && (
          <p className={bulkActive ? "text-xs font-medium text-success" : "text-xs text-muted-foreground"}>
            {bulkActive ? "Mengenpreis aktiv" : `Noch ${formatQuantity(remaining)} bis Mengenpreis`}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={row.quantity}
            onChange={(e) => row.setQuantity(e.target.value)}
            inputMode="decimal"
            className="h-10 flex-1 text-right tabular-nums"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            variant={row.status === "success" ? "secondary" : "default"}
            loading={row.status === "loading"}
            onClick={row.handleAdd}
            aria-label={`${product.code} zum Warenkorb hinzufügen`}
          >
            {row.status === "success" ? <Check className="text-success" /> : <ShoppingCart />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

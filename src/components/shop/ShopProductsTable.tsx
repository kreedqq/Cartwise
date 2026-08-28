import { Check, ShoppingCart, Star } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useShopProductRow } from "@/hooks/useShopProductRow";
import { convertUsdToEur, formatEur, formatQuantity, formatUsd, hasBulkTier } from "@/lib/money";
import { shopCategoryById, shopCategoryIdFor } from "@/lib/shopCategories";
import type { Tables } from "@/types/database";

interface ShopProductsTableProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
}

export function ShopProductsTable({ products, rate, favoriteProductIds }: ShopProductsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead className="w-32">Artikelcode</TableHead>
          <TableHead className="min-w-[200px]">Produktname</TableHead>
          <TableHead className="w-40">Einzelpreis</TableHead>
          <TableHead className="w-48">Mengenpreis</TableHead>
          <TableHead className="w-28 text-right">Menge</TableHead>
          <TableHead className="w-16 text-right">In den Warenkorb</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <ShopProductRow
            key={product.id}
            product={product}
            rate={rate}
            isFavorite={favoriteProductIds.has(product.id)}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function ShopProductRow({
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
    <TableRow>
      <TableCell>
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
      </TableCell>
      <TableCell className="font-mono text-xs">{product.code}</TableCell>
      <TableCell>
        <p className="text-sm font-medium">{product.name}</p>
        {product.dosage_vial && <p className="text-xs text-muted-foreground">{product.dosage_vial}</p>}
        <p className="text-[11px] text-muted-foreground">{shopCategoryById(shopCategoryIdFor(product)).label}</p>
      </TableCell>
      <TableCell className="text-sm">
        <p className="text-base font-semibold tabular-nums tracking-tight">{formatUsd(product.price_usd)}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{formatEur(convertUsdToEur(product.price_usd, rate))}</p>
      </TableCell>
      <TableCell className="text-sm">
        {bulk ? (
          <>
            <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">
              {formatUsd(product.bulk_price_usd)}{" "}
              <span className="font-normal text-muted-foreground">ab {formatQuantity(product.bulk_price_min_quantity)}</span>
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatEur(convertUsdToEur(product.bulk_price_usd as number, rate))}
            </p>
            {bulkActive ? (
              <p className="mt-0.5 text-[11px] font-medium text-success">Mengenpreis aktiv</p>
            ) : remaining != null && remaining > 0 ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">Noch {formatQuantity(remaining)} bis Mengenpreis</p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Kein Mengenpreis</p>
        )}
      </TableCell>
      <TableCell>
        <Input
          value={row.quantity}
          onChange={(e) => row.setQuantity(e.target.value)}
          inputMode="decimal"
          className="h-9 text-right tabular-nums"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="icon"
          variant={row.status === "success" ? "secondary" : "default"}
          loading={row.status === "loading"}
          onClick={row.handleAdd}
          aria-label={`${product.code} zum Warenkorb hinzufügen`}
        >
          {row.status === "success" ? <Check className="text-success" /> : <ShoppingCart />}
        </Button>
      </TableCell>
    </TableRow>
  );
}

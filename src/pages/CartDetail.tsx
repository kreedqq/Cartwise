import * as React from "react";
import { useParams } from "react-router-dom";
import { PackageOpen } from "lucide-react";

import { CartHeader } from "@/components/cart/CartHeader";
import { CartSummaryBar } from "@/components/cart/CartSummaryBar";
import { Layers, ShoppingBag, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { CartItemsTable } from "@/components/cart/CartItemsTable";
import { CartItemsMobileList } from "@/components/cart/CartItemsMobileList";
import { AddItemBar } from "@/components/cart/AddItemBar";
import { PasteImportDialog } from "@/components/cart/PasteImportDialog";
import { PriceUpdateDialog } from "@/components/cart/PriceUpdateDialog";
import { DuplicateWarningBanner } from "@/components/cart/DuplicateWarningBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCarts } from "@/hooks/useCarts";
import { useCartItems } from "@/hooks/useCartItems";
import { useCartComputed } from "@/hooks/useCartComputed";
import { useKitShareCustomerLockMap } from "@/hooks/useKitShareCustomerLockMap";
import { useExchangeRate } from "@/hooks/useExchangeRate";

export default function CartDetailPage() {
  const { cartId } = useParams<{ cartId: string }>();
  const cartsQuery = useCarts();
  const itemsQuery = useCartItems(cartId);
  const rateQuery = useExchangeRate();
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [priceUpdateOpen, setPriceUpdateOpen] = React.useState(false);

  const cart = cartsQuery.data?.find((c) => c.id === cartId);
  const { items, totals, duplicateCodes } = useCartComputed(itemsQuery.data, rateQuery.data?.rate ?? null);
  const kitShareIds = React.useMemo(
    () => items.map((item) => item.kit_share_id).filter((id): id is string => Boolean(id)),
    [items],
  );
  const kitLockQuery = useKitShareCustomerLockMap(kitShareIds);
  const isKitCartLineLocked = React.useCallback(
    (kitShareId: string | null) => (kitShareId ? (kitLockQuery.data?.get(kitShareId) ?? false) : false),
    [kitLockQuery.data],
  );
  const nextPosition = (itemsQuery.data?.length ?? 0) === 0 ? 0 : Math.max(...(itemsQuery.data ?? []).map((i) => i.position)) + 1;
  const hasKitLines = items.some((item) => Boolean(item.kit_share_id));

  if (cartsQuery.isLoading || itemsQuery.isLoading) return <FullScreenSpinner label="Warenkorb wird geladen …" />;

  if (cartsQuery.isError || itemsQuery.isError) {
    return (
      <ErrorState
        message="Warenkorb konnte nicht geladen werden."
        onRetry={() => {
          cartsQuery.refetch();
          itemsQuery.refetch();
        }}
      />
    );
  }

  if (!cart) {
    return (
      <EmptyState
        title="Warenkorb nicht gefunden"
        description="Dieser Warenkorb existiert nicht oder du hast keine Berechtigung, ihn zu sehen."
      />
    );
  }

  const rate = rateQuery.data;

  return (
    <div className="space-y-6">
      <CartHeader cart={cart} />

      {/* Shipping transparency banner */}
      {cart.status !== "ordered" && (
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" aria-hidden="true" />
          <p>
            <span className="font-medium text-foreground">Versand</span>: Versandkosten aus China und Deutschland werden nach Auftragseingang zugewiesen. Der Gesamtpreis inkl. Versand erscheint in der Bestellübersicht.
          </p>
        </div>
      )}

      <DuplicateWarningBanner cartId={cart.id} duplicateCodes={duplicateCodes} items={items} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {cart.status === "ordered" ? (
            <p className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
              Dieser Warenkorb wurde bereits als Bestellung abgeschickt und ist deshalb schreibgeschützt.
            </p>
          ) : (
            <AddItemBar
              cartId={cart.id}
              nextPosition={nextPosition}
              currentRate={rate?.rate ?? null}
              onOpenPasteImport={() => setPasteOpen(true)}
            />
          )}

          {itemsQuery.isFetching && !itemsQuery.isLoading && <Skeleton className="h-2 w-full" />}

          {items.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-card px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <PackageOpen className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                Warenkorb ist leer
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Füge oben einen Artikelcode ein oder entdecke Produkte im Shop.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/shop">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Zum Shop
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/kit-gesuche">
                    <Layers className="h-3.5 w-3.5" />
                    Kit Gesuche
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Kit-items context banner — only when the cart has Kit-allocated lines */}
              {hasKitLines && (
                <div className="flex items-start gap-3 border border-primary/30 bg-primary/[0.05] px-4 py-4 text-sm">
                  <span className="mt-0.5 h-10 w-px shrink-0 bg-primary" aria-hidden="true" />
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Geteilte Kits</span>: Mengen folgen der Zuteilung und sind gesperrt. Nach Vollständigkeit werden Bestellungen automatisch synchronisiert.
                  </p>
                </div>
              )}

              <div className="hidden lg:block">
                <CartItemsTable
                  items={items}
                  cartId={cart.id}
                  currentRate={rate?.rate ?? null}
                  rateLoading={rateQuery.isLoading || rateQuery.isFetching}
                  nextPosition={nextPosition}
                  readOnly={cart.status === "ordered"}
                  isKitCartLineLocked={isKitCartLineLocked}
                  shopArea={cart.shop_area}
                />
              </div>
              <div className="lg:hidden">
                <CartItemsMobileList
                  items={items}
                  cartId={cart.id}
                  currentRate={rate?.rate ?? null}
                  rateLoading={rateQuery.isLoading || rateQuery.isFetching}
                  nextPosition={nextPosition}
                  readOnly={cart.status === "ordered"}
                  isKitCartLineLocked={isKitCartLineLocked}
                  shopArea={cart.shop_area}
                />
              </div>
            </>
          )}
        </div>

        <CartSummaryBar
          cartId={cart.id}
          cartStatus={cart.status}
          totals={totals}
          rate={rate}
          rateLoading={rateQuery.isFetching}
          onRefreshRate={() => rateQuery.refresh()}
          onUpdatePrices={() => setPriceUpdateOpen(true)}
        />
      </div>

      <PasteImportDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        cartId={cart.id}
        nextPosition={nextPosition}
        currentRate={rate?.rate ?? null}
      />

      <PriceUpdateDialog
        open={priceUpdateOpen}
        onOpenChange={setPriceUpdateOpen}
        cartId={cart.id}
        items={itemsQuery.data ?? []}
        currentRate={rate?.rate ?? null}
      />
    </div>
  );
}

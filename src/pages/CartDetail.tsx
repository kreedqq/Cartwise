import * as React from "react";
import { useParams } from "react-router-dom";
import { PackageOpen } from "lucide-react";

import { CartHeader } from "@/components/cart/CartHeader";
import { CartSummaryBar } from "@/components/cart/CartSummaryBar";
import { CartItemsTable } from "@/components/cart/CartItemsTable";
import { CartItemsMobileList } from "@/components/cart/CartItemsMobileList";
import { AddItemBar } from "@/components/cart/AddItemBar";
import { PasteImportDialog } from "@/components/cart/PasteImportDialog";
import { PriceUpdateDialog } from "@/components/cart/PriceUpdateDialog";
import { DuplicateWarningBanner } from "@/components/cart/DuplicateWarningBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useCarts } from "@/hooks/useCarts";
import { useCartItems } from "@/hooks/useCartItems";
import { useCartComputed } from "@/hooks/useCartComputed";
import { useExchangeRate } from "@/hooks/useExchangeRate";

export default function CartDetailPage() {
  const { cartId } = useParams<{ cartId: string }>();
  const cartsQuery = useCarts();
  const itemsQuery = useCartItems(cartId);
  const rateQuery = useExchangeRate();
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [priceUpdateOpen, setPriceUpdateOpen] = React.useState(false);

  const cart = cartsQuery.data?.find((c) => c.id === cartId);
  const { items, totals, duplicateCodes } = useCartComputed(itemsQuery.data);
  const nextPosition = (itemsQuery.data?.length ?? 0) === 0 ? 0 : Math.max(...(itemsQuery.data ?? []).map((i) => i.position)) + 1;

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
            <EmptyState
              icon={PackageOpen}
              title="Dein Warenkorb ist noch leer."
              description="Füge oben einen Artikelcode und eine Menge hinzu, oder füge mehrere Zeilen auf einmal ein."
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <CartItemsTable
                  items={items}
                  cartId={cart.id}
                  currentRate={rate?.rate ?? null}
                  nextPosition={nextPosition}
                  readOnly={cart.status === "ordered"}
                />
              </div>
              <div className="lg:hidden">
                <CartItemsMobileList
                  items={items}
                  cartId={cart.id}
                  currentRate={rate?.rate ?? null}
                  nextPosition={nextPosition}
                  readOnly={cart.status === "ordered"}
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

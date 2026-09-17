import * as React from "react";
import { Link } from "react-router-dom";
import { Check, ShoppingCart, X } from "lucide-react";

import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { Button } from "@/components/ui/button";
import { useCartDrawer } from "@/context/CartDrawerContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Slide-in confirmation panel that appears after a product is added to cart.
 *
 * Desktop: slides in from the right edge (bottom-right corner).
 * Mobile: slides up from the bottom edge.
 *
 * Auto-closes after 4 seconds (or on user close / navigation).
 * Shows product name, quantity, effective unit price, and line total.
 */
export function CartDrawer() {
  const { item, isOpen, closeDrawer } = useCartDrawer();

  // item stays non-null while the slide-out animation plays (context clears it after 350ms)
  if (!item) return null;
  const displayItem = item;

  return (
    <>
      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={closeDrawer}
        />
      )}

      {/* Desktop: slide in from bottom-right corner */}
      <aside
        aria-live="polite"
        aria-label="Artikel hinzugefügt"
        className={cn(
          "fixed bottom-6 right-6 z-50 hidden w-80 rounded-2xl border border-border bg-card shadow-[var(--shadow-elevated)] transition-[opacity,transform] duration-[var(--motion-default)]",
          "lg:flex lg:flex-col",
          isOpen
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0 pointer-events-none",
        )}
      >
        <DrawerContent item={displayItem} onClose={closeDrawer} />
      </aside>

      {/* Mobile: slide up from bottom */}
      <aside
        aria-live="polite"
        aria-label="Artikel hinzugefügt"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card shadow-[var(--shadow-elevated)] transition-transform duration-[var(--motion-default)]",
          "flex flex-col lg:hidden",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <DrawerContent item={displayItem} onClose={closeDrawer} />
      </aside>
    </>
  );
}

function DrawerContent({
  item,
  onClose,
}: {
  item: {
    productName: string;
    cartId: string;
    quantity?: number;
    unitPriceUsd?: number | null;
    variantLabel?: string | null;
  };
  onClose: () => void;
}) {
  const rateQuery = useExchangeRate();
  const rate = rateQuery.data?.rate ?? null;

  const hasPrice =
    item.unitPriceUsd != null &&
    item.unitPriceUsd > 0 &&
    item.quantity != null;
  const lineTotalUsd =
    hasPrice ? (item.unitPriceUsd as number) * (item.quantity as number) : null;

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Zum Warenkorb hinzugefügt
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold leading-snug">
            {item.productName}
          </p>
          {item.variantLabel && (
            <p className="truncate text-xs text-muted-foreground">
              {item.variantLabel}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 -mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Price summary ── (only when price data is available) ── */}
      {hasPrice && (
        <div className="rounded-lg bg-secondary/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">
                Menge: {formatQuantity(item.quantity as number)}
              </p>
              <p className="text-[11px] text-muted-foreground">Einzelpreis</p>
              <DualCurrencyPrice
                usd={item.unitPriceUsd as number}
                rate={rate}
                size="compact"
              />
            </div>
            {lineTotalUsd != null && (
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Gesamt</p>
                <DualCurrencyPrice
                  usd={lineTotalUsd}
                  rate={rate}
                  size="compact"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-col gap-2">
        <Button asChild size="sm" className="w-full" onClick={onClose}>
          <Link to={`/carts/${item.cartId}/checkout`}>Zur Kasse</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="w-full" onClick={onClose}>
          <Link to={`/carts/${item.cartId}`}>
            <ShoppingCart className="h-3.5 w-3.5" />
            Zum Warenkorb
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onClose}>
          Weiter einkaufen
        </Button>
      </div>
    </div>
  );
}

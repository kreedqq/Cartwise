import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { MoreVertical, ShoppingBasket, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useCartMutations } from "@/hooks/useCarts";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { cn } from "@/lib/utils";
import { isOpenCart } from "@/services/carts";
import { toast } from "@/components/ui/toaster";
import type { CartSummaryRow, Tables } from "@/types/database";

interface CartCardProps {
  cart: Tables<"carts">;
  summary?: CartSummaryRow;
}

function positionLabel(count: number): string {
  return count === 1 ? "1 Position" : `${count} Positionen`;
}

export function CartCard({ cart, summary }: CartCardProps) {
  const navigate = useNavigate();
  const { remove } = useCartMutations();

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const itemCount = summary?.item_count ?? 0;
  const cartHref = `/carts/${cart.id}`;

  function openCart() {
    navigate(cartHref);
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(cart.id);
      setDeleteOpen(false);
      toast.success("Warenkorb gelöscht.");
    } catch (error) {
      console.error("Warenkorb löschen fehlgeschlagen:", error);
      toast.error("Löschen fehlgeschlagen.");
    }
  }

  return (
    <>
      <Card
        className={cn(
          "transition-colors hover:border-primary/50 hover:bg-secondary/30",
          cart.is_active_cart && "border-primary/40 ring-1 ring-primary/15",
        )}
      >
        <div className="flex items-start gap-3 p-4">
          <Link to={cartHref} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3" aria-label={`Warenkorb ${cart.name} öffnen`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
              <ShoppingBasket className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{cart.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{positionLabel(itemCount)}</span>
              <span className="mt-1 block">
                <DualCurrencyPrice usd={summary?.total_usd ?? 0} eur={summary?.total_eur} size="compact" />
              </span>
              {cart.is_active_cart ? (
                <span className="mt-1 block text-xs font-medium text-primary">Aktiver Warenkorb</span>
              ) : null}
              {(summary?.unresolved_count ?? 0) > 0 ? (
                <span className="mt-1 block text-xs font-medium text-warning">
                  {summary!.unresolved_count} Artikel nicht gefunden
                </span>
              ) : null}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {isOpenCart(cart.status) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Warenkorb löschen"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Warenkorb-Aktionen">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openCart}>Öffnen</DropdownMenuItem>
                {isOpenCart(cart.status) && (
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 /> Löschen
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Warenkorb löschen?"
        description="Dieser Warenkorb und seine nicht bestellten Positionen werden entfernt."
        confirmLabel="Löschen"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

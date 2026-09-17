import * as React from "react";

import { useShopCart } from "@/hooks/useShopCart";
import { useFavoriteMutations } from "@/hooks/useFavorites";
import { useCartDrawer } from "@/context/CartDrawerContext";
import { toast } from "@/components/ui/toaster";
import { isValidQuantity } from "@/lib/money";
import type { Tables } from "@/types/database";

export type QuickAddStatus = "idle" | "loading" | "success";

/**
 * "See product, enter quantity, click cart" (section 8/9): one click adds
 * directly to the active cart (creating it first if needed) with a brief
 * success flash, no dialog, no page change.
 */
function stepQuantityInOptions(current: string, direction: 1 | -1, options: readonly number[]): string {
  const num = Number(current.replace(",", "."));
  const idx = options.findIndex((value) => value === num);
  if (idx >= 0) {
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < options.length) return String(options[nextIdx]);
    return String(options[idx]);
  }
  const fallback = options[0] ?? 1;
  return String(fallback);
}

export function useShopProductRow(
  product: Tables<"products">,
  rate: number | null,
  isFavorite: boolean,
  quantityOptions: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
) {
  const [quantity, setQuantity] = React.useState(String(quantityOptions[0] ?? 1));
  const [status, setStatus] = React.useState<QuickAddStatus>("idle");
  const { addToActiveCart } = useShopCart();
  const { add: addFavorite, remove: removeFavorite } = useFavoriteMutations();
  const { openDrawer } = useCartDrawer();

  async function handleAdd() {
    const qty = Number(quantity.replace(",", "."));
    if (!isValidQuantity(qty)) {
      toast.error("Bitte gib eine gültige Menge zwischen 0,001 und 100.000 ein.");
      return;
    }
    setStatus("loading");
    try {
      const item = await addToActiveCart(product.code, qty, rate);
      if (item.resolution_status === "resolved") {
        setStatus("success");
        window.setTimeout(() => setStatus("idle"), 1500);
        // Open cart drawer to confirm the add — pass price/qty for richer confirmation
        openDrawer({
          productName: item.product_name_snapshot ?? product.code,
          cartId: item.cart_id,
          quantity: item.quantity ?? qty,
          unitPriceUsd: item.unit_price_usd_snapshot,
          variantLabel: product.dosage_vial ?? null,
        });
      } else {
        setStatus("idle");
        toast.error(`„${product.code}" konnte nicht hinzugefügt werden (nicht mehr verfügbar).`);
      }
    } catch (error) {
      setStatus("idle");
      console.error("Zum Warenkorb hinzufügen fehlgeschlagen:", error);
      toast.error("Konnte nicht zum Warenkorb hinzugefügt werden.");
    }
  }

  async function toggleFavorite() {
    try {
      if (isFavorite) {
        await removeFavorite.mutateAsync(product.id);
      } else {
        await addFavorite.mutateAsync(product.id);
        toast.success("Zu „Meine Artikel“ hinzugefügt.");
      }
    } catch (error) {
      console.error("Favorit ändern fehlgeschlagen:", error);
      toast.error("Favorit konnte nicht geändert werden.");
    }
  }

  function bumpQuantity(direction: 1 | -1) {
    setQuantity((prev) => stepQuantityInOptions(prev, direction, quantityOptions));
  }

  return {
    quantity,
    setQuantity,
    bumpQuantity,
    quantityOptions,
    status,
    handleAdd,
    toggleFavorite,
    favoritePending: addFavorite.isPending || removeFavorite.isPending,
  };
}

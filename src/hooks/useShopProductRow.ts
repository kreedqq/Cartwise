import * as React from "react";

import { useShopCart } from "@/hooks/useShopCart";
import { useFavoriteMutations } from "@/hooks/useFavorites";
import { toast } from "@/components/ui/toaster";
import { isValidQuantity } from "@/lib/money";
import type { Tables } from "@/types/database";

export type QuickAddStatus = "idle" | "loading" | "success";

/**
 * "See product, enter quantity, click cart" (section 8/9): one click adds
 * directly to the active cart (creating it first if needed) with a brief
 * success flash, no dialog, no page change.
 */
export function useShopProductRow(product: Tables<"products">, rate: number | null, isFavorite: boolean) {
  const [quantity, setQuantity] = React.useState("1");
  const [status, setStatus] = React.useState<QuickAddStatus>("idle");
  const { addToActiveCart } = useShopCart();
  const { add: addFavorite, remove: removeFavorite } = useFavoriteMutations();

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

  return {
    quantity,
    setQuantity,
    status,
    handleAdd,
    toggleFavorite,
    favoritePending: addFavorite.isPending || removeFavorite.isPending,
  };
}

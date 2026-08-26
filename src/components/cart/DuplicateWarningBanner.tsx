import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartItemMutations } from "@/hooks/useCartItems";
import { toast } from "@/components/ui/toaster";
import type { ComputedCartItem } from "@/hooks/useCartComputed";

interface DuplicateWarningBannerProps {
  cartId: string;
  duplicateCodes: string[];
  items: ComputedCartItem[];
}

export function DuplicateWarningBanner({ cartId, duplicateCodes, items }: DuplicateWarningBannerProps) {
  const { merge } = useCartItemMutations(cartId);

  if (duplicateCodes.length === 0) return null;

  async function handleMerge(code: string) {
    const group = items.filter((i) => (i.product_code_snapshot ?? i.product_code_input.trim().toUpperCase()) === code);
    try {
      await merge.mutateAsync(group);
      toast.success(`Duplikate für „${code}" wurden zusammengeführt.`);
    } catch {
      toast.error("Zusammenführen fehlgeschlagen. Bitte lade die Seite neu und versuche es erneut.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 font-medium text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Doppelte Artikelcodes gefunden: {duplicateCodes.join(", ")}
      </p>
      <div className="flex flex-wrap gap-2">
        {duplicateCodes.map((code) => (
          <Button key={code} size="sm" variant="outline" onClick={() => handleMerge(code)} loading={merge.isPending}>
            „{code}" zusammenführen
          </Button>
        ))}
      </div>
    </div>
  );
}

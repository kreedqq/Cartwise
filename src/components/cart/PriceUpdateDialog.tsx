import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { getProductsByIds } from "@/services/products";
import { useCartItemMutations } from "@/hooks/useCartItems";
import { buildPriceUpdateDiff, type PriceUpdateDiff } from "@/lib/snapshot";
import { formatEur, formatRate, formatUsd } from "@/lib/money";
import { toast } from "@/components/ui/toaster";
import type { Tables } from "@/types/database";

interface PriceUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartId: string;
  items: Tables<"cart_items">[];
  currentRate: number | null;
}

export function PriceUpdateDialog({ open, onOpenChange, cartId, items, currentRate }: PriceUpdateDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [diffs, setDiffs] = React.useState<PriceUpdateDiff[] | null>(null);
  const [productLookup, setProductLookup] = React.useState<Map<string, Tables<"products">>>(new Map());
  const { refreshPrice } = useCartItemMutations(cartId);

  const resolvedItems = React.useMemo(
    () => items.filter((i) => i.product_id != null && i.resolution_status !== "not_found"),
    [items],
  );

  // Standard "fetch when a dialog opens" data-loading effect: resets the
  // preview when closed, otherwise loads current product prices and derives
  // the diff table. Not a props-to-state mirror - this is genuinely
  // triggered by an external event (the dialog opening) and involves async
  // work, which is exactly what effects are for.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!open) {
      setDiffs(null);
      return;
    }
    setLoading(true);
    getProductsByIds(resolvedItems.map((i) => i.product_id as string))
      .then((products) => {
        setProductLookup(products);
        const computed = resolvedItems
          .map((item) => {
            const product = products.get(item.product_id as string);
            if (!product) return null;
            return buildPriceUpdateDiff(item, product, currentRate);
          })
          .filter((d): d is PriceUpdateDiff => d !== null && d.changed);
        setDiffs(computed);
      })
      .catch(() => toast.error("Aktuelle Preise konnten nicht geladen werden."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentRate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleApply() {
    if (!diffs) return;
    setLoading(true);
    let succeeded = 0;
    let failed = 0;
    for (const diff of diffs) {
      const item = resolvedItems.find((i) => i.id === diff.itemId);
      const product = item ? productLookup.get(item.product_id as string) : undefined;
      if (!item || !product) {
        failed += 1;
        continue;
      }
      try {
        await refreshPrice.mutateAsync({ item, product, currentRate });
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    setLoading(false);
    onOpenChange(false);
    if (failed === 0) {
      toast.success(`${succeeded} Position(en) aktualisiert.`);
    } else {
      toast.error(`${succeeded} aktualisiert, ${failed} fehlgeschlagen (evtl. zwischenzeitlich geändert).`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preise aktualisieren</DialogTitle>
          <DialogDescription>
            Übernimmt die aktuellen Katalogpreise und den aktuellen Wechselkurs für alle Positionen mit
            abweichenden Werten. Bisherige Preisstände bleiben über die Preishistorie nachvollziehbar.
          </DialogDescription>
        </DialogHeader>

        {loading && !diffs && <p className="py-8 text-center text-sm text-muted-foreground">Wird geprüft …</p>}

        {diffs && diffs.length === 0 && (
          <EmptyState title="Alle Preise sind aktuell" description="Es gibt keine abweichenden Preise oder Kurse zu übernehmen." />
        )}

        {diffs && diffs.length > 0 && (
          <>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Alter Preis</TableHead>
                    <TableHead className="text-right">Neuer Preis</TableHead>
                    <TableHead className="text-right">Alter Kurs</TableHead>
                    <TableHead className="text-right">Neuer Kurs</TableHead>
                    <TableHead className="text-right">Differenz USD</TableHead>
                    <TableHead className="text-right">Differenz EUR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.map((d) => (
                    <TableRow key={d.itemId}>
                      <TableCell className="font-mono text-xs">{d.productCodeSnapshot}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatUsd(d.oldUnitPriceUsd)}
                        {d.oldPriceTier === "bulk" && (
                          <span className="ml-1 text-[10px] text-muted-foreground">(Mengenpreis)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium">
                        {formatUsd(d.newUnitPriceUsd)}
                        {d.newPriceTier === "bulk" && (
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">(Mengenpreis)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatRate(d.oldRate)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium">{formatRate(d.newRate)}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums text-xs font-medium ${diffColor(d.diffUsd)}`}
                      >
                        {d.diffUsd != null ? formatUsd(d.diffUsd) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums text-xs font-medium ${diffColor(d.diffEur)}`}
                      >
                        {d.diffEur != null ? formatEur(d.diffEur) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Diese Aktion kann nicht automatisch rückgängig gemacht werden, alte Werte bleiben aber in der
              Preishistorie des jeweiligen Produkts erhalten.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleApply} loading={loading}>
                {diffs.length} Position(en) übernehmen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function diffColor(value: number | null): string {
  if (value == null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-destructive" : "text-success";
}

import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePasteLine } from "@/lib/validation";
import { formatUsd, getEffectiveUnitPrice } from "@/lib/money";
import { resolveProductsByCodes } from "@/services/products";
import { useCartItemMutations } from "@/hooks/useCartItems";
import { toast } from "@/components/ui/toaster";
import type { Tables } from "@/types/database";

interface PasteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartId: string;
  nextPosition: number;
  currentRate: number | null;
}

interface PreviewRow {
  raw: string;
  code: string | null;
  quantity: number | null;
  error: string | null;
  product?: Tables<"products">;
}

export function PasteImportDialog({ open, onOpenChange, cartId, nextPosition, currentRate }: PasteImportDialogProps) {
  const [text, setText] = React.useState("");
  const [preview, setPreview] = React.useState<PreviewRow[] | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const { addBulk } = useCartItemMutations(cartId);

  // Clears the paste buffer/preview once the dialog is closed, so reopening
  // it starts fresh rather than showing the last import's leftovers.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!open) {
      setText("");
      setPreview(null);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleAnalyze() {
    const lines = text
      .split("\n")
      .map((l) => parsePasteLine(l))
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (lines.length === 0) {
      toast.error("Bitte füge mindestens eine Zeile im Format „CODE  MENGE“ ein.");
      return;
    }

    setResolving(true);
    try {
      const codes = lines.filter((l) => l.code).map((l) => l.code as string);
      const products = await resolveProductsByCodes(codes);
      setPreview(
        lines.map((l) => ({
          raw: l.raw,
          code: l.code,
          quantity: l.quantity,
          error: l.error,
          product: l.code ? products.get(l.code) : undefined,
        })),
      );
    } catch (error) {
      console.error("Artikelcodes prüfen fehlgeschlagen:", error);
      toast.error("Artikelcodes konnten nicht geprüft werden.");
    } finally {
      setResolving(false);
    }
  }

  const validRows = (preview ?? []).filter((r) => !r.error && r.code && r.quantity);
  const problemCount = (preview ?? []).length - validRows.length;

  async function handleImport() {
    if (validRows.length === 0) return;
    try {
      await addBulk.mutateAsync({
        lines: validRows.map((r) => ({ code: r.code as string, quantity: r.quantity as number })),
        startPosition: nextPosition,
        rate: currentRate,
      });
      toast.success(`${validRows.length} Position(en) hinzugefügt.`);
      onOpenChange(false);
    } catch (error) {
      console.error("Paste-Import fehlgeschlagen:", error);
      toast.error("Import fehlgeschlagen.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mehrere Artikel einfügen</DialogTitle>
          <DialogDescription>
            Füge Zeilen im Format <code className="rounded bg-secondary px-1 py-0.5">ARTIKELCODE&nbsp;&nbsp;MENGE</code>{" "}
            ein - z. B. direkt aus Excel kopiert (Tab- oder mehrfach-Leerzeichen-getrennt), eine Position pro Zeile.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={"ART-1001\t5\nART-2002\t2\nART-3001\t10"}
              className="font-mono text-xs"
            />
            <DialogFooter>
              <Button onClick={handleAnalyze} loading={resolving}>
                Prüfen
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Artikel</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead className="text-right">Einzelpreis</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{row.code ?? row.raw}</TableCell>
                      <TableCell className="text-xs">{row.product?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{row.quantity ?? "—"}</TableCell>
                      {/* Shows the price this quantity will actually get, so a
                          bulk threshold is visible before importing. */}
                      <TableCell className="text-right tabular-nums text-xs">
                        <UnitPricePreview product={row.product} quantity={row.quantity} />
                      </TableCell>
                      <TableCell>
                        {row.error ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3" /> {row.error}
                          </span>
                        ) : !row.product ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Unbekannter Code
                          </span>
                        ) : !row.product.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                            <AlertTriangle className="h-3 w-3" /> Deaktiviert
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {validRows.length} von {preview.length} Zeile(n) werden importiert.
              {problemCount > 0 && ` ${problemCount} Zeile(n) mit Problemen werden übersprungen.`}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Zurück
              </Button>
              <Button onClick={handleImport} loading={addBulk.isPending} disabled={validRows.length === 0}>
                {validRows.length} Position(en) importieren
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnitPricePreview({ product, quantity }: { product?: Tables<"products">; quantity: number | null }) {
  if (!product || quantity == null) return <span className="text-muted-foreground">—</span>;
  const effective = getEffectiveUnitPrice(product, quantity);
  return (
    <span>
      {formatUsd(effective.unitPriceUsd)}
      {effective.tier === "bulk" && <span className="ml-1 text-[10px] text-primary">Mengenpreis</span>}
    </span>
  );
}

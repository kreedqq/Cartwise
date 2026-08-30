import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Upload } from "lucide-react";

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
import { ImportPreviewTable } from "@/components/admin/ImportPreviewTable";
import { CSV_HEADERS, parseProductCsv } from "@/services/csvProducts";
import { applyImport } from "@/services/pdfImport";
import { listAllProducts } from "@/services/products";
import { toast } from "@/components/ui/toaster";
import {
  applyRowEdit,
  summarizeReviewRows,
  toApplyPayload,
  toReviewRows,
  type ImportReviewRow,
} from "@/lib/importReview";

interface ProductCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

/**
 * The quick path: paste (or pick) a CSV in the product administration. Uses
 * the same parser, preview table and apply RPC as the full import page, so
 * both routes write exactly the same fields.
 */
export function ProductCsvImportDialog({ open, onOpenChange, onImported }: ProductCsvImportDialogProps) {
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<ImportReviewRow[] | null>(null);
  const [unknownHeaders, setUnknownHeaders] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // The *unfiltered* catalog, so the "neu anlegen vs. aktualisieren" preview is
  // correct even while a search filter is active in the product table. The
  // server re-resolves the match anyway; this only keeps the preview honest.
  const catalogQuery = useQuery({
    queryKey: ["admin-products-index"],
    queryFn: () => listAllProducts(),
    enabled: open,
  });

  const productIdByCode = React.useMemo(
    () => new Map((catalogQuery.data ?? []).map((p) => [p.code, p.id] as const)),
    [catalogQuery.data],
  );

  // Clears the CSV text/preview once the dialog is closed, so reopening it
  // starts fresh rather than showing the previous import's leftovers.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!open) {
      setText("");
      setRows(null);
      setUnknownHeaders([]);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((content) => setText(content));
  }

  function handleAnalyze() {
    const parsed = parseProductCsv(text);
    if (parsed.rows.length === 0) {
      toast.error(`Keine Datenzeilen erkannt. Erwartete Kopfzeile: ${CSV_HEADERS.join(",")}`);
      return;
    }
    setUnknownHeaders(parsed.unknownHeaders);
    setRows(toReviewRows(parsed.rows, productIdByCode));
  }

  function handleEdit(index: number, patch: Partial<ImportReviewRow>) {
    setRows((prev) => (prev ? prev.map((row, i) => (i === index ? applyRowEdit(row, patch, productIdByCode) : row)) : prev));
  }

  const summary = React.useMemo(() => summarizeReviewRows(rows ?? []), [rows]);

  async function handleImport() {
    if (!rows) return;
    setSubmitting(true);
    try {
      const result = await applyImport({
        filePath: "csv-import:inline",
        fileName: "produkte-import.csv",
        fileSizeBytes: new Blob([text]).size,
        hasTextLayer: null,
        rows: toApplyPayload(rows),
      });

      toast.success(
        `Import abgeschlossen: ${result.created} neu, ${result.updated} aktualisiert, ${result.skipped} übersprungen, ${result.failed} fehlgeschlagen.`,
      );
      onImported();
      onOpenChange(false);
    } catch (error) {
      console.error("CSV-Import fehlgeschlagen:", error);
      toast.error(`CSV-Import fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler."}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Produkte per CSV importieren</DialogTitle>
          <DialogDescription>
            Erwartete Kopfzeile:{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-xs">{CSV_HEADERS.join(",")}</code>. Deutsche
            Spaltentitel wie „Artikelcode“, „Mengenpreis“ oder „Mengenpreis ab“ werden ebenfalls erkannt, die
            Spaltenreihenfolge ist beliebig.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="space-y-3">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={CSV_HEADERS.join(",")}
              className="font-mono text-xs"
            />
            <DialogFooter>
              <Button onClick={handleAnalyze}>
                <Upload /> Prüfen
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {unknownHeaders.length > 0 && (
              <p className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Nicht erkannte Spalten werden nicht importiert: <strong>{unknownHeaders.join(", ")}</strong>
                </span>
              </p>
            )}

            <div className="max-h-[26rem] overflow-x-auto overflow-y-auto">
              <ImportPreviewTable rows={rows} onEdit={handleEdit} />
            </div>

            <p className="text-xs text-muted-foreground">
              {summary.applicable} von {summary.total} Zeile(n) werden importiert · {summary.create} neu ·{" "}
              {summary.update} Aktualisierung(en) · {summary.skip} übersprungen · {summary.error} fehlerhaft.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRows(null)}>
                Zurück
              </Button>
              <Button onClick={handleImport} loading={submitting} disabled={summary.applicable === 0}>
                Import anwenden
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

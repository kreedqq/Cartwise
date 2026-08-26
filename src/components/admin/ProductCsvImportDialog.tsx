import * as React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseProductCsv, type CsvProductRow } from "@/services/csvProducts";
import { applyImport, type ReviewedImportRow } from "@/services/pdfImport";
import { toast } from "@/components/ui/toaster";
import type { ImportRowAction, Tables } from "@/types/database";

interface ProductCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: Tables<"products">[];
  onImported: () => void;
}

interface ReviewRow extends CsvProductRow {
  action: ImportRowAction;
  targetProductId: string | null;
}

export function ProductCsvImportDialog({ open, onOpenChange, existingProducts, onImported }: ProductCsvImportDialogProps) {
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<ReviewRow[] | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const codeToProduct = React.useMemo(() => {
    const map = new Map<string, Tables<"products">>();
    for (const p of existingProducts) map.set(p.code, p);
    return map;
  }, [existingProducts]);

  // Clears the CSV text/preview once the dialog is closed, so reopening it
  // starts fresh rather than showing the previous import's leftovers.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!open) {
      setText("");
      setRows(null);
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
    if (parsed.length === 0) {
      toast.error("Keine Zeilen erkannt. Erwartete Spalten: code,name,description,category,price_usd,is_active");
      return;
    }
    setRows(
      parsed.map((row) => {
        const existing = row.code ? codeToProduct.get(row.code) : undefined;
        return {
          ...row,
          action: row.error ? "skip" : existing ? "update" : "create",
          targetProductId: existing?.id ?? null,
        };
      }),
    );
  }

  function updateAction(index: number, action: ImportRowAction) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, action } : r)) : prev));
  }

  async function handleImport() {
    if (!rows) return;
    setSubmitting(true);
    try {
      const reviewed: ReviewedImportRow[] = rows.map((r) => ({
        rowNumber: r.rowNumber,
        rawText: `${r.code ?? ""};${r.name ?? ""};${r.priceUsd ?? ""}`,
        parsedCode: r.code,
        parsedName: r.name,
        parsedPriceUsd: r.priceUsd,
        quality: r.error ? "error" : "ok",
        qualityReason: r.error,
        action: r.action,
        targetProductId: r.targetProductId,
      }));

      const result = await applyImport({
        filePath: "csv-import:inline",
        fileName: "produkte-import.csv",
        fileSizeBytes: new Blob([text]).size,
        hasTextLayer: null,
        rows: reviewed,
      });

      toast.success(
        `Import abgeschlossen: ${result.created} neu, ${result.updated} aktualisiert, ${result.skipped} übersprungen, ${result.failed} fehlgeschlagen.`,
      );
      onImported();
      onOpenChange(false);
    } catch {
      toast.error("CSV-Import fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Produkte per CSV importieren</DialogTitle>
          <DialogDescription>
            Erwartete Spalten (Kopfzeile): <code className="rounded bg-secondary px-1 py-0.5">code,name,description,category,price_usd,is_active</code>
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="space-y-3">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="code,name,description,category,price_usd,is_active"
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
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Preis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{row.code ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row.name ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs">{row.priceUsd ?? "—"}</TableCell>
                      <TableCell>
                        {row.error ? (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3 w-3" /> {row.error}
                          </span>
                        ) : (
                          <span className="text-xs text-success">OK</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.action}
                          onValueChange={(v) => updateAction(i, v as ImportRowAction)}
                          disabled={!!row.error}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Neu anlegen</SelectItem>
                            <SelectItem value="update">Aktualisieren</SelectItem>
                            <SelectItem value="skip">Überspringen</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRows(null)}>
                Zurück
              </Button>
              <Button onClick={handleImport} loading={submitting}>
                Import anwenden
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

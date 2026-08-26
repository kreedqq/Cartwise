import * as React from "react";
import { AlertTriangle, CheckCircle2, FileWarning, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { toast } from "@/components/ui/toaster";
import { extractPdfText } from "@/pdf/parsePdf";
import { flagDuplicateCodes, parseAllLines, type ParsedImportRow } from "@/pdf/parseProductLines";
import { applyImport, uploadImportFile, type ApplyImportResult, type ReviewedImportRow } from "@/services/pdfImport";
import { listAllProducts } from "@/services/products";
import { MAX_PDF_SIZE_BYTES } from "@/lib/constants";
import type { ImportRowAction, Tables } from "@/types/database";

interface ReviewRow extends ParsedImportRow {
  action: ImportRowAction;
  targetProductId: string | null;
}

type Stage = "upload" | "no-text-layer" | "preview" | "result";

export default function AdminPdfImportPage() {
  const [stage, setStage] = React.useState<Stage>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [manualText, setManualText] = React.useState("");
  const [existingProducts, setExistingProducts] = React.useState<Tables<"products">[]>([]);
  const [result, setResult] = React.useState<ApplyImportResult | null>(null);
  const [applying, setApplying] = React.useState(false);

  async function loadExistingProducts() {
    const products = await listAllProducts();
    setExistingProducts(products);
    return products;
  }

  function buildReviewRows(parsed: ParsedImportRow[], products: Tables<"products">[]): ReviewRow[] {
    const byCode = new Map(products.map((p) => [p.code, p]));
    return flagDuplicateCodes(parsed).map((row) => {
      const existing = row.parsedCode ? byCode.get(row.parsedCode) : undefined;
      return {
        ...row,
        action: row.quality === "error" ? "skip" : existing ? "update" : "create",
        targetProductId: existing?.id ?? null,
      };
    });
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== "application/pdf") {
      toast.error("Bitte wähle eine PDF-Datei aus.");
      return;
    }
    if (selected.size > MAX_PDF_SIZE_BYTES) {
      toast.error("Die Datei ist zu groß (maximal 10 MB).");
      return;
    }

    setFile(selected);
    setBusy(true);
    try {
      const [{ hasTextLayer, lines }, products] = await Promise.all([extractPdfText(selected), loadExistingProducts()]);
      if (!hasTextLayer || lines.length === 0) {
        setStage("no-text-layer");
        return;
      }
      const parsed = parseAllLines(lines);
      setRows(buildReviewRows(parsed, products));
      setStage("preview");
    } catch (error) {
      console.error(error);
      toast.error("PDF konnte nicht gelesen werden. Ist die Datei beschädigt oder passwortgeschützt?");
    } finally {
      setBusy(false);
    }
  }

  async function handleManualTextAnalyze() {
    if (manualText.trim() === "") {
      toast.error("Bitte füge Text ein.");
      return;
    }
    setBusy(true);
    try {
      const products = await loadExistingProducts();
      const parsed = parseAllLines(manualText.split("\n"));
      setRows(buildReviewRows(parsed, products));
      setStage("preview");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleApply() {
    setApplying(true);
    try {
      const filePath = file ? await uploadImportFile(file) : "manual-text:inline";
      const reviewed: ReviewedImportRow[] = rows.map((r) => ({
        rowNumber: r.rowNumber,
        rawText: r.rawText,
        parsedCode: r.parsedCode,
        parsedName: r.parsedName,
        parsedPriceUsd: r.parsedPriceUsd,
        quality: r.quality,
        qualityReason: r.qualityReason,
        action: r.action,
        targetProductId: r.targetProductId,
      }));

      const applied = await applyImport({
        filePath,
        fileName: file?.name ?? "manueller-text-import.txt",
        fileSizeBytes: file?.size ?? new Blob([manualText]).size,
        hasTextLayer: file ? true : null,
        rows: reviewed,
      });

      setResult(applied);
      setStage("result");
    } catch (error) {
      console.error(error);
      toast.error("Import konnte nicht angewendet werden.");
    } finally {
      setApplying(false);
    }
  }

  function reset() {
    setStage("upload");
    setFile(null);
    setRows([]);
    setManualText("");
    setResult(null);
  }

  return (
    <div className="space-y-4">
      {stage === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>PDF-Produktliste importieren</CardTitle>
            <CardDescription>
              Lade eine PDF-Datei mit einer Artikeltabelle hoch (Artikelcode, Name, Preis in USD). Maximal 10&nbsp;MB.
              Alle erkannten Zeilen werden dir vor dem Import zur Prüfung angezeigt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input type="file" accept="application/pdf" onChange={handleFileSelected} disabled={busy} />
            {busy && <p className="mt-3 text-sm text-muted-foreground">PDF wird analysiert …</p>}
          </CardContent>
        </Card>
      )}

      {stage === "no-text-layer" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <FileWarning className="h-5 w-5" /> Kein Textlayer erkannt
            </CardTitle>
            <CardDescription>
              Diese PDF-Datei scheint aus gescannten Bildern zu bestehen - es konnte kein Text extrahiert werden.
              Automatische Texterkennung (OCR) ist in dieser Version bewusst nicht implementiert (siehe
              docs/RISKS.md). Bitte nutze stattdessen den CSV-Import in der Produktverwaltung, oder füge den
              Inhalt der Datei unten manuell als Text ein.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="manual-text">Text manuell einfügen (eine Position pro Zeile)</Label>
            <Textarea
              id="manual-text"
              rows={8}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={"ART-1001  Bürostuhl ergonomisch  189.90\nART-1002  Schreibtisch 160x80  429.00"}
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Abbrechen
              </Button>
              <Button onClick={handleManualTextAnalyze} loading={busy}>
                Prüfen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Import-Vorschau</CardTitle>
            <CardDescription>
              Prüfe jede Zeile. Fehlerhafte Zeilen sind rot markiert und werden standardmäßig übersprungen. Du kannst
              Werte korrigieren und die Aktion je Zeile ändern, bevor der Import angewendet wird.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Preis USD</TableHead>
                    <TableHead>Qualität</TableHead>
                    <TableHead>Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={
                        row.quality === "error"
                          ? "bg-destructive/[0.04]"
                          : row.quality === "warning"
                            ? "bg-warning/[0.04]"
                            : undefined
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell>
                        <Input
                          value={row.parsedCode ?? ""}
                          onChange={(e) => updateRow(i, { parsedCode: e.target.value })}
                          className="h-8 w-28 font-mono text-xs uppercase"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.parsedName ?? ""}
                          onChange={(e) => updateRow(i, { parsedName: e.target.value })}
                          className="h-8 w-48 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.parsedPriceUsd ?? ""}
                          onChange={(e) => updateRow(i, { parsedPriceUsd: Number(e.target.value) || null })}
                          className="h-8 w-24 text-right text-xs tabular-nums"
                        />
                      </TableCell>
                      <TableCell>
                        {row.quality === "ok" && (
                          <span className="inline-flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                        {row.quality === "warning" && (
                          <span className="inline-flex items-center gap-1 text-xs text-warning" title={row.qualityReason ?? ""}>
                            <AlertTriangle className="h-3 w-3" /> Prüfen
                          </span>
                        )}
                        {row.quality === "error" && (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive" title={row.qualityReason ?? ""}>
                            <AlertTriangle className="h-3 w-3" /> Fehler
                          </span>
                        )}
                        {row.qualityReason && <p className="mt-0.5 max-w-[10rem] text-[10px] text-muted-foreground">{row.qualityReason}</p>}
                      </TableCell>
                      <TableCell>
                        <Select value={row.action} onValueChange={(v) => updateRow(i, { action: v as ImportRowAction })}>
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Neu anlegen</SelectItem>
                            <SelectItem value="update" disabled={!row.targetProductId}>
                              Aktualisieren
                            </SelectItem>
                            <SelectItem value="skip">Überspringen</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {rows.filter((r) => r.action !== "skip").length} von {rows.length} Zeile(n) werden verarbeitet
                {existingProducts.length > 0 && ` · ${existingProducts.length} Produkte in der Datenbank geprüft`}.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  Abbrechen
                </Button>
                <Button onClick={handleApply} loading={applying}>
                  <Upload /> Import anwenden
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "result" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" /> Import abgeschlossen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultStat label="Erstellt" value={result.created} />
              <ResultStat label="Aktualisiert" value={result.updated} />
              <ResultStat label="Übersprungen" value={result.skipped} />
              <ResultStat label="Fehlgeschlagen" value={result.failed} />
            </div>
            <Button onClick={reset}>Weiteren Import starten</Button>
          </CardContent>
        </Card>
      )}

      {stage === "upload" && rows.length === 0 && (
        <EmptyState
          title="Bereit für den ersten Import"
          description="Lade eine PDF-Datei hoch, um loszulegen. Nichts wird automatisch übernommen, bevor du die Vorschau bestätigst."
        />
      )}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

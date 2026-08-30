import * as React from "react";
import { AlertTriangle, CheckCircle2, FileWarning, Upload } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { ImportPreviewTable } from "@/components/admin/ImportPreviewTable";
import { toast } from "@/components/ui/toaster";
import { extractPdfText } from "@/pdf/parsePdf";
import { parseAllLines, parsePdfRows } from "@/pdf/parseProductLines";
import { applyImport, uploadImportFile, type ApplyImportResult } from "@/services/pdfImport";
import { parseProductCsv } from "@/services/csvProducts";
import { parseProductXlsx } from "@/services/xlsxProducts";
import {
  ACCEPTED_IMPORT_ACCEPT,
  ACCEPTED_IMPORT_LABEL,
  detectImportSourceKind,
} from "@/services/productImportSource";
import { listAllProducts } from "@/services/products";
import {
  applyRowEdit,
  summarizeReviewRows,
  toApplyPayload,
  toReviewRows,
  type ImportReviewRow,
} from "@/lib/importReview";
import { IMPORT_FIELD_TITLES, type ImportField, type ParsedProductImportRow } from "@/lib/productImportRow";
import { MAX_PDF_SIZE_BYTES } from "@/lib/constants";

type Stage = "upload" | "no-text-layer" | "preview" | "result";

interface ParseOutcome {
  rows: ParsedProductImportRow[];
  recognizedFields: ImportField[];
  unknownHeaders: string[];
  hasTextLayer: boolean | null;
}

export default function AdminPdfImportPage() {
  const [stage, setStage] = React.useState<Stage>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [rows, setRows] = React.useState<ImportReviewRow[]>([]);
  const [outcome, setOutcome] = React.useState<ParseOutcome | null>(null);
  const [manualText, setManualText] = React.useState("");
  const [productIdByCode, setProductIdByCode] = React.useState<Map<string, string>>(new Map());
  const [result, setResult] = React.useState<ApplyImportResult | null>(null);
  const [applying, setApplying] = React.useState(false);

  async function loadProductIndex(): Promise<Map<string, string>> {
    const products = await listAllProducts();
    const index = new Map(products.map((p) => [p.code, p.id] as const));
    setProductIdByCode(index);
    return index;
  }

  function showPreview(parsed: ParseOutcome, index: Map<string, string>) {
    setOutcome(parsed);
    setRows(toReviewRows(parsed.rows, index));
    setStage("preview");
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const kind = detectImportSourceKind(selected.name);
    if (!kind) {
      toast.error(`Nicht unterstütztes Format. Erlaubt sind: ${ACCEPTED_IMPORT_LABEL}.`);
      return;
    }
    if (selected.size > MAX_PDF_SIZE_BYTES) {
      toast.error("Die Datei ist zu groß (maximal 10 MB).");
      return;
    }

    setFile(selected);
    setBusy(true);
    try {
      const index = await loadProductIndex();

      if (kind === "pdf") {
        const { hasTextLayer, rows: pdfRows } = await extractPdfText(selected);
        if (!hasTextLayer || pdfRows.length === 0) {
          setStage("no-text-layer");
          return;
        }
        showPreview(
          { rows: parsePdfRows(pdfRows), recognizedFields: [], unknownHeaders: [], hasTextLayer: true },
          index,
        );
        return;
      }

      const parsed =
        kind === "csv" ? parseProductCsv(await selected.text()) : await parseProductXlsx(selected);

      if (parsed.rows.length === 0) {
        toast.error(
          "Keine Datenzeilen erkannt. Bitte prüfe, ob die Datei eine Kopfzeile mit Spalten wie „code“, „name“ und „price_usd“ enthält.",
        );
        setFile(null);
        return;
      }

      showPreview({ ...parsed, hasTextLayer: null }, index);
    } catch (error) {
      console.error(error);
      toast.error("Datei konnte nicht gelesen werden. Ist sie beschädigt oder passwortgeschützt?");
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
      const index = await loadProductIndex();
      showPreview(
        {
          rows: parseAllLines(manualText.split("\n")),
          recognizedFields: [],
          unknownHeaders: [],
          hasTextLayer: null,
        },
        index,
      );
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(index: number, patch: Partial<ImportReviewRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? applyRowEdit(row, patch, productIdByCode) : row)));
  }

  const summary = React.useMemo(() => summarizeReviewRows(rows), [rows]);

  async function handleApply() {
    setApplying(true);
    try {
      const filePath = file ? await uploadImportFile(file) : "manual-text:inline";
      const applied = await applyImport({
        filePath,
        fileName: file?.name ?? "manueller-text-import.txt",
        fileSizeBytes: file?.size ?? new Blob([manualText]).size,
        hasTextLayer: outcome?.hasTextLayer ?? null,
        rows: toApplyPayload(rows),
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
    setOutcome(null);
    setManualText("");
    setResult(null);
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Produktimport"
        description={`Unterstützte Formate: ${ACCEPTED_IMPORT_LABEL}. Vor Übernahme zur Prüfung angezeigt.`}
      />
      {stage === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Produktpreisliste importieren</CardTitle>
            <CardDescription>
              Unterstützte Formate: {ACCEPTED_IMPORT_LABEL}. Maximal 10&nbsp;MB. Erkannte Spalten: CODE, Name,
              Dosage / Vial, Normalpreis, Mengenpreis, Mengenpreis ab, Kategorie, Status. Alle Zeilen werden dir
              vor dem Import zur Prüfung angezeigt - nichts wird automatisch übernommen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input type="file" accept={ACCEPTED_IMPORT_ACCEPT} onChange={handleFileSelected} disabled={busy} />
            {busy && <p className="mt-3 text-sm text-muted-foreground">Datei wird analysiert …</p>}
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
              docs/RISKS.md). Bitte nutze stattdessen eine CSV- oder Excel-Datei, oder füge den Inhalt unten
              manuell als Text ein.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="manual-text">Text manuell einfügen (eine Position pro Zeile)</Label>
            <Textarea
              id="manual-text"
              rows={8}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={"ART-1001  Testosteron  10 mg/Vial  60.00  55.00  10\nART-1002  Beispiel  5 mg/Vial  42.00"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Spaltenreihenfolge im Fallback: Code, Name, …, Normalpreis, Mengenpreis, Mengenpreis ab. Zeilen mit
              unklarer Zuordnung werden als „Prüfen“ markiert und nie automatisch übernommen.
            </p>
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
              Der Artikelcode ist der Schlüssel: bekannte Codes werden aktualisiert, unbekannte neu angelegt. Du
              musst nichts manuell zuordnen - nur prüfen, ggf. korrigieren und einzelne Zeilen überspringen.
              Fehlerhafte Zeilen werden nie importiert.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {outcome && outcome.recognizedFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Erkannte Spalten:</span>
                {outcome.recognizedFields.map((field) => (
                  <Badge key={field} variant="secondary">
                    {IMPORT_FIELD_TITLES[field]}
                  </Badge>
                ))}
              </div>
            )}
            {outcome && outcome.unknownHeaders.length > 0 && (
              <p className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Diese Spalten wurden nicht erkannt und werden nicht importiert:{" "}
                  <strong>{outcome.unknownHeaders.join(", ")}</strong>. Benenne sie um, falls sie übernommen
                  werden sollen.
                </span>
              </p>
            )}

            <div className="overflow-x-auto">
              <ImportPreviewTable rows={rows} onEdit={handleEdit} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {summary.applicable} von {summary.total} Zeile(n) werden importiert · {summary.create} neu ·{" "}
                {summary.update} Aktualisierung(en) · {summary.skip} übersprungen · {summary.error} fehlerhaft.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  Abbrechen
                </Button>
                <Button onClick={handleApply} loading={applying} disabled={summary.applicable === 0}>
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
          description="Lade eine PDF-, CSV- oder Excel-Datei hoch, um loszulegen. Nichts wird automatisch übernommen, bevor du die Vorschau bestätigst."
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

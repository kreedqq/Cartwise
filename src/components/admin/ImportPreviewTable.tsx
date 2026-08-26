import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolvedAction, type ImportReviewRow, type ResolvedImportAction } from "@/lib/importReview";

const ACTION_LABEL: Record<ResolvedImportAction, string> = {
  create: "Neu anlegen",
  update: "Aktualisieren",
  skip: "Überspringen",
  error: "Fehler",
};

const ACTION_VARIANT: Record<ResolvedImportAction, "success" | "secondary" | "outline" | "destructive"> = {
  create: "success",
  update: "secondary",
  skip: "outline",
  error: "destructive",
};

interface ImportPreviewTableProps {
  rows: ImportReviewRow[];
  onEdit: (index: number, patch: Partial<ImportReviewRow>) => void;
}

/**
 * The mandatory review step: every field that will be written is visible and
 * editable before anything reaches the database. Shared by the file-import
 * page and the CSV paste dialog so both show exactly the same columns.
 */
export function ImportPreviewTable({ rows, onEdit }: ImportPreviewTableProps) {
  return (
    <Table className="min-w-[1180px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead className="w-32">CODE</TableHead>
          <TableHead className="min-w-[170px]">Name</TableHead>
          <TableHead className="w-32">Dosage / Vial</TableHead>
          <TableHead className="w-28 text-right">Normalpreis</TableHead>
          <TableHead className="w-28 text-right">Mengenpreis</TableHead>
          <TableHead className="w-28 text-right">Mengenpreis ab</TableHead>
          <TableHead className="w-32">Kategorie</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="min-w-[150px]">Qualität</TableHead>
          <TableHead className="w-40">Aktion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const action = resolvedAction(row);
          return (
            <TableRow
              key={row.rowNumber}
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
                  aria-label={`Artikelcode Zeile ${row.rowNumber}`}
                  value={row.parsedCode ?? ""}
                  onChange={(e) => onEdit(index, { parsedCode: e.target.value })}
                  className="h-8 font-mono text-xs uppercase"
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Name Zeile ${row.rowNumber}`}
                  value={row.parsedName ?? ""}
                  onChange={(e) => onEdit(index, { parsedName: e.target.value })}
                  className="h-8 text-xs"
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Dosage / Vial Zeile ${row.rowNumber}`}
                  value={row.parsedDosageVial ?? ""}
                  onChange={(e) => onEdit(index, { parsedDosageVial: e.target.value })}
                  className="h-8 text-xs"
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Normalpreis Zeile ${row.rowNumber}`}
                  value={row.priceDraft}
                  onChange={(e) => onEdit(index, { priceDraft: e.target.value })}
                  inputMode="decimal"
                  className="h-8 text-right text-xs tabular-nums"
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Mengenpreis Zeile ${row.rowNumber}`}
                  value={row.bulkPriceDraft}
                  onChange={(e) => onEdit(index, { bulkPriceDraft: e.target.value })}
                  inputMode="decimal"
                  placeholder="—"
                  className="h-8 text-right text-xs tabular-nums"
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Mengenpreis ab Zeile ${row.rowNumber}`}
                  value={row.bulkMinDraft}
                  onChange={(e) => onEdit(index, { bulkMinDraft: e.target.value })}
                  inputMode="decimal"
                  placeholder="—"
                  className="h-8 text-right text-xs tabular-nums"
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Kategorie Zeile ${row.rowNumber}`}
                  value={row.parsedCategory ?? ""}
                  onChange={(e) => onEdit(index, { parsedCategory: e.target.value })}
                  className="h-8 text-xs"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={statusValue(row.parsedIsActive)}
                  onValueChange={(value) => onEdit(index, { parsedIsActive: statusFromValue(value) })}
                >
                  <SelectTrigger className="h-8 text-xs" aria-label={`Status Zeile ${row.rowNumber}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unchanged">Unverändert</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <QualityCell row={row} />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Select
                    value={row.action === "skip" ? "skip" : "auto"}
                    onValueChange={(value) => onEdit(index, { action: value === "skip" ? "skip" : "auto" })}
                  >
                    <SelectTrigger className="h-8 text-xs" aria-label={`Aktion Zeile ${row.rowNumber}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Importieren</SelectItem>
                      <SelectItem value="skip">Überspringen</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant={ACTION_VARIANT[action]}>{ACTION_LABEL[action]}</Badge>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function QualityCell({ row }: { row: ImportReviewRow }) {
  const Icon = row.quality === "ok" ? CheckCircle2 : AlertTriangle;
  const tone =
    row.quality === "ok" ? "text-success" : row.quality === "warning" ? "text-warning" : "text-destructive";
  const label = row.quality === "ok" ? "OK" : row.quality === "warning" ? "Prüfen" : "Fehler";

  return (
    <div className="space-y-0.5">
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
        <Icon className="h-3 w-3" /> {label}
      </span>
      {row.qualityReason && (
        <p className="max-w-[16rem] text-[10px] leading-snug text-muted-foreground">{row.qualityReason}</p>
      )}
      {row.quality !== "error" && row.rawText && (
        <p
          className="flex max-w-[16rem] items-start gap-1 truncate text-[10px] text-muted-foreground/70"
          title={row.rawText}
        >
          <Info className="mt-px h-2.5 w-2.5 shrink-0" />
          {row.rawText}
        </p>
      )}
    </div>
  );
}

function statusValue(isActive: boolean | null): string {
  if (isActive === null) return "unchanged";
  return isActive ? "active" : "inactive";
}

function statusFromValue(value: string): boolean | null {
  if (value === "active") return true;
  if (value === "inactive") return false;
  return null;
}

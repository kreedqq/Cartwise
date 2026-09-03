import { BRAND_NAME } from "@/lib/constants";
import { formatQuantity, formatUsd } from "@/lib/money";
import type { ProcessingOrderSummary } from "@/lib/orderSummary";
import { downloadPdf } from "@/lib/pdfDocument";
import { buildPeptixOrderSummaryPdf } from "@/lib/pdf/peptixOrderSummaryPdf";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildProcessingOrderSummaryPrintHtml(
  summary: ProcessingOrderSummary,
  exportedAt: string,
): string {
  const groupTables = summary.groups
    .map((group) => {
      const rows = group.lines
        .map(
          (line) => `<tr>
        <td>${escapeHtml(line.code)}</td>
        <td>${escapeHtml(line.name)}</td>
        <td class="num">${escapeHtml(line.quantityLabel)}</td>
        <td class="num">${escapeHtml(formatUsd(line.totalUsd))}</td>
      </tr>`,
        )
        .join("");
      return `<h2>${escapeHtml(group.label)}</h2>
  <table>
    <thead>
      <tr>
        <th>CODE</th><th>ARTIKEL</th><th class="num">MENGE</th><th class="num">GESAMTPREIS</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
    })
    .join("");

  const personRows =
    summary.personLines.length === 0
      ? `<p class="muted">Keine Bestellungen in Bearbeitung</p>`
      : `<table>
    <thead>
      <tr>
        <th>NAME</th><th>MENGE</th><th>DOSIS</th><th>ARTIKEL</th>
      </tr>
    </thead>
    <tbody>${summary.personLines
      .map(
        (line) => `<tr>
        <td>${escapeHtml(line.name)}</td>
        <td>${escapeHtml(line.quantityLabel)}</td>
        <td>${escapeHtml(line.dose)}</td>
        <td>${escapeHtml(line.article)}</td>
      </tr>`,
      )
      .join("")}</tbody>
  </table>`;

  const body =
    summary.orderCount === 0
      ? `<p>Keine Bestellungen in Bearbeitung</p>`
      : `${groupTables}
  <div class="totals">
    <div>Gesamtanzahl Produkte: ${summary.productCount}</div>
    <div>Gesamtmenge: ${escapeHtml(formatQuantity(summary.totalQuantity))}</div>
    <div><strong>Gesamtpreis: ${escapeHtml(formatUsd(summary.totalUsd))}</strong></div>
  </div>
  <h2>BESTELLUNGEN</h2>
  <p class="muted">WER HAT WAS BESTELLT UND IN WELCHER MENGE</p>
  <p>PERSONEN ${summary.personCount} · POSITIONEN ${summary.positionCount} · GESAMTMENGE ${summary.personQuantityTotal}</p>
  ${personRows}`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Bestell Zusammenfassung</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #1a1612; margin: 32px; font-size: 13px; background: #fff; }
    h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.18em; text-transform: uppercase; color: #b8893a; }
    h2 { font-size: 14px; margin: 28px 0 8px; letter-spacing: 0.08em; text-transform: uppercase; color: #b8893a; }
    h3 { font-size: 14px; margin: 16px 0 4px; }
    .muted { color: #6b6258; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #e6dfd4; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b6258; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 16px; text-align: right; }
    .totals strong { font-size: 16px; color: #b8893a; }
    ul { margin: 0; padding-left: 18px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(BRAND_NAME)}</h1>
      <p class="muted">BESTELL ZUSAMMENFASSUNG</p>
      <p>Nur Bestellungen mit Status <strong>In Bearbeitung</strong></p>
    </div>
    <div class="muted" style="text-align:right">
      <div>Export: ${escapeHtml(exportedAt)}</div>
    </div>
  </header>
  ${body}
</body>
</html>`;
}

export function buildProcessingOrderSummaryPdf(
  summary: ProcessingOrderSummary,
  exportedAt: string,
): Uint8Array {
  return buildPeptixOrderSummaryPdf(summary, exportedAt);
}

export function downloadProcessingOrderSummaryPdf(summary: ProcessingOrderSummary, exportedAt: string): Uint8Array | null {
  if (summary.orderCount === 0) return null;
  const bytes = buildProcessingOrderSummaryPdf(summary, exportedAt);
  downloadPdf("Bestell-Zusammenfassung.pdf", bytes);
  return bytes;
}

/** @deprecated use downloadProcessingOrderSummaryPdf — kept as the button entry point. */
export function printProcessingOrderSummary(summary: ProcessingOrderSummary, exportedAt: string): Uint8Array | null {
  return downloadProcessingOrderSummaryPdf(summary, exportedAt);
}

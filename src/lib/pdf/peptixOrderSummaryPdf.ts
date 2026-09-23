import logoInline from "./peptix-template-logo.jpg?inline";
import { formatUsd } from "@/lib/money";
import {
  formatChinaPurchasePriceCells,
  type ChinaPurchaseLine,
  type OrderSummaryPersonLine,
  type ProcessingOrderSummary,
} from "@/lib/orderSummary";
import { assemblePdf, bytesFromDataUrl, jpegImageXObject, pdfLiteral } from "@/lib/pdfDocument";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const GOLD = "0.843 0.659 0.290";
const GOLD_LIGHT = "0.949 0.827 0.541";
const GOLD_STROKE = "0.490 0.353 0.141";
const CREAM = "0.969 0.957 0.929";
const MUTED = "0.686 0.663 0.616";
const PAGE_FILL = "0.020 0.020 0.020";
const PANEL = "0.051 0.051 0.051";
const LOGO_W = 147.4;
const LOGO_H = 163.78;
const LOGO_X = 36.85;
const LOGO_Y = 672.44;
const CARD_X = 63.78;
const CARD_W = 467.72;
const META_Y = 578.12;
const META_H = 39.69;

/** Dynamic list layout (no fixed table grid — avoids footer/row overlap). */
export const ORDER_ROWS_PER_PAGE = 32;
export const CHINA_PRODUCT_ROWS_PER_PAGE = 18;
const ORDER_ROW_H = 13.2;
const CHINA_ROW_H = 13.2;
const ORDER_LIST_TOP = 505;
const ORDER_LIST_BOTTOM = 72;
const CHINA_LIST_TOP = 455;
const CHINA_FOOTER_TOP = 195;

const ORDER_COL_USER = CARD_X + 8;
const ORDER_COL_CODE = CARD_X + 168;
const ORDER_COL_QTY = CARD_X + 318;

const CHINA_COL_CODE = CARD_X + 8;
const CHINA_COL_QTY = CARD_X + 118;
const CHINA_COL_PRICE = CARD_X + 248;
const CHINA_COL_TOTAL = CARD_X + 378;

const HELVETICA_WIDTHS: number[] = [
  278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278,
  278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333,
  278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722,
  667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333,
  500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

let logoBytes: Uint8Array | null = null;

function templateLogoJpeg(): Uint8Array {
  if (logoBytes) return logoBytes;
  const value = String(logoInline ?? "");
  if (value.startsWith("data:") || value.startsWith("/9j/") || value.includes("base64,")) {
    logoBytes = bytesFromDataUrl(value);
    return logoBytes;
  }
  throw new Error("Peptix template logo could not be inlined for the PDF export.");
}

function rgb(color: string, fill: boolean): string {
  return `${color} ${fill ? "rg" : "RG"}`;
}

function rect(x: number, y: number, w: number, h: number): string {
  return `${n(x)} ${n(y)} ${n(w)} ${n(h)} re`;
}

function n(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`;
}

function fontWidth(text: string, size: number, bold: boolean): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    const units = HELVETICA_WIDTHS[code] ?? 556;
    width += units * (bold ? 1.08 : 1);
  }
  return (width * size) / 1000;
}

function fitText(text: string, size: number, maxWidth: number, bold = false): string {
  if (fontWidth(text, size, bold) <= maxWidth) return text;
  const ellipsis = "...";
  let current = text;
  while (current.length > 0 && fontWidth(current + ellipsis, size, bold) > maxWidth) {
    current = current.slice(0, -1);
  }
  return current ? `${current}${ellipsis}` : ellipsis;
}

function textAt(x: number, y: number, text: string, size: number, bold: boolean, color: string): string {
  return [
    "BT",
    `/${bold ? "F2" : "F1"} ${n(size)} Tf`,
    rgb(color, true),
    `1 0 0 1 ${n(x)} ${n(y)} Tm`,
    `${pdfLiteral(text)} Tj`,
    "ET",
  ].join("\n");
}

function contentStream(ops: string[]): string {
  const stream = ops.join("\n");
  const length = new TextEncoder().encode(stream).length;
  return `<< /Length ${length} >>\nstream\n${stream}\nendstream`;
}

function chrome(pageLabel: string, pageNumber: number, subtitle: string): string[] {
  const number = String(pageNumber).padStart(2, "0");
  return [
    rgb(PAGE_FILL, true),
    rect(0, 0, PAGE_W, PAGE_H),
    "f",
    "q",
    `${n(LOGO_W)} 0 0 ${n(LOGO_H)} ${n(LOGO_X)} ${n(LOGO_Y)} cm`,
    "/Im1 Do",
    "Q",
    rgb(GOLD_STROKE, false),
    "0.55 w",
    line(51.02, 677.48, 544.25, 677.48),
    line(51.02, 36.85, 544.25, 36.85),
    textAt(51.02, 24, "PEPTIX • BESTELL ZUSAMMENFASSUNG", 7, true, GOLD),
    textAt(537, 24, number, 7, true, GOLD),
    textAt(57.02, 643, pageLabel, 20, true, GOLD),
    textAt(57.02, 633, subtitle, 8, true, GOLD_LIGHT),
  ];
}

const STATS_Y = META_Y - 44;

function metaBox(datum: string, status: string, zeitraum: string, y = META_Y): string[] {
  const colW = CARD_W / 3;
  return [
    rgb(PANEL, true),
    rect(CARD_X, y, CARD_W, META_H),
    "f",
    rgb(GOLD_STROKE, false),
    "0.6 w",
    rect(CARD_X, y, CARD_W, META_H),
    "S",
    rgb(GOLD_STROKE, false),
    "0.35 w",
    line(CARD_X + colW, y, CARD_X + colW, y + META_H),
    line(CARD_X + colW * 2, y, CARD_X + colW * 2, y + META_H),
    textAt(CARD_X + 11.2, y + 22.5, "DATUM", 7.2, true, MUTED),
    textAt(CARD_X + 11.2, y + 8.5, datum, 8, false, CREAM),
    textAt(CARD_X + colW + 11.2, y + 22.5, "STATUS", 7.2, true, MUTED),
    textAt(CARD_X + colW + 11.2, y + 8.5, status, 8, false, CREAM),
    textAt(CARD_X + colW * 2 + 11.2, y + 22.5, "ZEITRAUM", 7.2, true, MUTED),
    textAt(CARD_X + colW * 2 + 11.2, y + 8.5, zeitraum, 8, false, CREAM),
  ];
}

function statsBox(personen: string, positionen: string, produkte: string, y = STATS_Y): string[] {
  const colW = CARD_W / 3;
  return [
    rgb(PANEL, true),
    rect(CARD_X, y, CARD_W, META_H),
    "f",
    rgb(GOLD_STROKE, false),
    "0.6 w",
    rect(CARD_X, y, CARD_W, META_H),
    "S",
    rgb(GOLD_STROKE, false),
    "0.35 w",
    line(CARD_X + colW, y, CARD_X + colW, y + META_H),
    line(CARD_X + colW * 2, y, CARD_X + colW * 2, y + META_H),
    textAt(CARD_X + 12.2, y + 22.5, "PERSONEN", 7.2, true, MUTED),
    textAt(CARD_X + 12.2, y + 6.5, personen, 14, false, CREAM),
    textAt(CARD_X + colW + 12.2, y + 22.5, "POSITIONEN", 7.2, true, MUTED),
    textAt(CARD_X + colW + 12.2, y + 6.5, positionen, 14, false, CREAM),
    textAt(CARD_X + colW * 2 + 12.2, y + 22.5, "PRODUKTE", 7.2, true, MUTED),
    textAt(CARD_X + colW * 2 + 12.2, y + 6.5, produkte, 14, false, CREAM),
  ];
}

function listPanel(top: number, bottom: number): string[] {
  const height = top - bottom;
  return [
    rgb(PANEL, true),
    rect(CARD_X, bottom, CARD_W, height),
    "f",
    rgb(GOLD_STROKE, false),
    "0.45 w",
    rect(CARD_X, bottom, CARD_W, height),
    "S",
  ];
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size));
  return pages;
}

function splitExportStamp(exportedAt: string): { datum: string; zeitraum: string } {
  const [datum, ...rest] = exportedAt.split(",").map((part) => part.trim());
  return {
    datum: datum || exportedAt,
    zeitraum: rest.join(", ") || "Aktuell",
  };
}

function displayUsername(name: string): string {
  return name.trim().replace(/^@+/, "");
}

/** Two-page export: orders by person, then China purchase aggregated by product code. */
export function planPeptixOrderSummaryPages(summary: ProcessingOrderSummary): string[] {
  const orderPages = Math.max(1, Math.ceil(summary.personLines.length / ORDER_ROWS_PER_PAGE));
  const chinaPages = Math.max(1, Math.ceil(summary.chinaPurchase.lines.length / CHINA_PRODUCT_ROWS_PER_PAGE));
  return [
    ...Array.from({ length: orderPages }, () => "BESTELLUNGEN"),
    ...Array.from({ length: chinaPages }, () => "CHINA BESTELLUNG"),
  ];
}

function orderPages(summary: ProcessingOrderSummary, exportedAt: string): string[] {
  const { datum, zeitraum } = splitExportStamp(exportedAt);
  const chunks = chunkRows(summary.personLines, ORDER_ROWS_PER_PAGE);
  return chunks.map((chunk, pageIndex) => {
    const listTop = pageIndex === 0 ? ORDER_LIST_TOP : 560;
    const ops = [
      ...chrome("BESTELLUNGEN", pageIndex + 1, "WER HAT WAS BESTELLT UND IN WELCHER MENGE"),
      ...(pageIndex === 0
        ? [
            ...metaBox(datum, "In Bearbeitung", zeitraum),
            ...statsBox(
              String(summary.personCount),
              String(summary.positionCount),
              String(summary.personDistinctProductCount),
            ),
          ]
        : []),
      ...listPanel(listTop, ORDER_LIST_BOTTOM),
      textAt(ORDER_COL_USER, listTop - 14, "NUTZERNAME", 7.5, true, MUTED),
      textAt(ORDER_COL_CODE, listTop - 14, "PRODUKT CODE", 7.5, true, MUTED),
      textAt(ORDER_COL_QTY, listTop - 14, "MENGE", 7.5, true, MUTED),
    ];
    chunk.forEach((line: OrderSummaryPersonLine, index) => {
      const y = listTop - 28 - index * ORDER_ROW_H;
      ops.push(
        textAt(ORDER_COL_USER, y, fitText(displayUsername(line.name), 8.5, 150), 8.5, false, CREAM),
        textAt(ORDER_COL_CODE, y, fitText(line.code, 8.5, 140), 8.5, false, CREAM),
        textAt(ORDER_COL_QTY, y, fitText(line.quantityLabel, 8.5, 120), 8.5, false, CREAM),
      );
    });
    return contentStream(ops);
  });
}

function chinaPages(summary: ProcessingOrderSummary, exportedAt: string, startPage: number): string[] {
  const { datum, zeitraum } = splitExportStamp(exportedAt);
  const purchase = summary.chinaPurchase;
  const chunks = chunkRows(purchase.lines, CHINA_PRODUCT_ROWS_PER_PAGE);
  return chunks.map((chunk, chunkIndex) => {
    const pageNumber = startPage + chunkIndex;
    const isLast = chunkIndex === chunks.length - 1;
    const ops = [
      ...chrome(
        "CHINA BESTELLUNG",
        pageNumber,
        "ORIGINALPREISE • KOPIERFREUNDLICHE BESTELLÜBERSICHT",
      ),
      ...metaBox(datum, "In Bearbeitung", zeitraum),
      textAt(CARD_X + 8, CHINA_LIST_TOP + 8, "Alle Bestellungen aggregiert. Originalpreise in USD, ohne Rollen- oder Verkaufsaufschläge.", 7, false, MUTED),
      ...listPanel(CHINA_LIST_TOP, isLast ? CHINA_FOOTER_TOP + 8 : ORDER_LIST_BOTTOM),
      textAt(CHINA_COL_CODE, CHINA_LIST_TOP - 14, "PRODUKT CODE", 7.5, true, MUTED),
      textAt(CHINA_COL_QTY, CHINA_LIST_TOP - 14, "MENGE", 7.5, true, MUTED),
      textAt(CHINA_COL_PRICE, CHINA_LIST_TOP - 14, "PREIS", 7.5, true, MUTED),
      textAt(CHINA_COL_TOTAL, CHINA_LIST_TOP - 14, "GESAMTPREIS", 7.5, true, MUTED),
    ];
    chunk.forEach((line: ChinaPurchaseLine, index) => {
      const y = CHINA_LIST_TOP - 28 - index * CHINA_ROW_H;
      const prices = formatChinaPurchasePriceCells(line);
      ops.push(
        textAt(CHINA_COL_CODE, y, fitText(line.code, 8.5, 100), 8.5, false, CREAM),
        textAt(CHINA_COL_QTY, y, fitText(line.quantityLabel, 8.5, 120), 8.5, false, CREAM),
        textAt(CHINA_COL_PRICE, y, fitText(prices.price, 8.5, 115), 8.5, false, CREAM),
        textAt(CHINA_COL_TOTAL, y, fitText(prices.total, 8.5, 90), 8.5, false, CREAM),
      );
    });
    if (isLast) {
      const footerY = CHINA_FOOTER_TOP;
      ops.push(
        rgb(GOLD_STROKE, false),
        "0.55 w",
        line(CARD_X, footerY + 52, CARD_X + CARD_W, footerY + 52),
        textAt(CARD_X + 8, footerY + 36, "GESAMT CHINA BESTELLUNG", 9, true, GOLD_LIGHT),
        textAt(CARD_X + CARD_W - 8 - fontWidth(formatUsd(purchase.totalUsd), 11, true), footerY + 34, formatUsd(purchase.totalUsd), 11, true, CREAM),
        textAt(CARD_X + 8, footerY + 16, "MENGENÜBERSICHT", 8, true, MUTED),
        textAt(CARD_X + 8, footerY + 2, `VERSCHIEDENE PRODUKTE: ${purchase.distinctProducts}`, 8, false, CREAM),
        textAt(CARD_X + 200, footerY + 2, `KITS: ${purchase.kitCount}`, 8, false, CREAM),
        textAt(CARD_X + 8, footerY - 12, `PACKUNGEN: ${purchase.packungCount}`, 8, false, CREAM),
        textAt(CARD_X + 200, footerY - 12, `STÜCK / VIALS: ${purchase.vialCount}`, 8, false, CREAM),
      );
    }
    return contentStream(ops);
  });
}

export function buildPeptixOrderSummaryPdf(summary: ProcessingOrderSummary, exportedAt: string): Uint8Array {
  const orders = orderPages(summary, exportedAt);
  const china = chinaPages(summary, exportedAt, orders.length + 1);
  const contents = [...orders, ...china];
  const jpeg = jpegImageXObject(templateLogoJpeg(), 630, 700);
  const pageObjectStart = 6 + contents.length;
  const pageRefs = contents.map((_, index) => `${pageObjectStart + index} 0 R`).join(" ");
  const objects: Array<string | Uint8Array> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs}] /Count ${contents.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    jpeg,
    ...contents,
    ...contents.map((_, index) => {
      const contentObject = 6 + index;
      return `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentObject} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> >>`;
    }),
  ];
  return assemblePdf(objects);
}

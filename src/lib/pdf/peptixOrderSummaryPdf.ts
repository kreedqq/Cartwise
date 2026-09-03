import logoInline from "./peptix-template-logo.jpg?inline";
import { formatUsd } from "@/lib/money";
import type { OrderSummaryGroup, OrderSummaryLine, OrderSummaryPersonLine, ProcessingOrderSummary } from "@/lib/orderSummary";
import { assemblePdf, bytesFromDataUrl, jpegImageXObject, pdfLiteral } from "@/lib/pdfDocument";
import type { ShopCategoryId } from "@/lib/shopCategories";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const GOLD = "0.843 0.659 0.290";
const GOLD_LIGHT = "0.949 0.827 0.541";
const GOLD_STROKE = "0.490 0.353 0.141";
const GRID = "0.227 0.200 0.153";
const CREAM = "0.969 0.957 0.929";
const MUTED = "0.686 0.663 0.616";
const PAGE_FILL = "0.020 0.020 0.020";
const PANEL = "0.051 0.051 0.051";
const HEADER_BAR = "0.082 0.071 0.051";
const LOGO_W = 147.4;
const LOGO_H = 163.78;
const LOGO_X = 36.85;
const LOGO_Y = 672.44;
const CARD_X = 63.78;
const CARD_W = 467.72;
const META_Y = 578.12;
const META_H = 39.69;
const TABLE_Y = 136.22;
const TABLE_H = 403.09;
const HEADER_H = 22.4;
const ROW_H = 22.4;
const BODY_ROWS = 17;
const FOOTER_H = 24.09;
const PRODUCT_COLS = [0, 79.4, 275, 354.3, 467.72];
const ORDER_COLS = [0, 119, 204, 301, 467.72];

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

function metaBox(datum: string, status: string, zeitraum: string): string[] {
  const colW = CARD_W / 3;
  return [
    rgb(PANEL, true),
    rect(CARD_X, META_Y, CARD_W, META_H),
    "f",
    rgb(GOLD_STROKE, false),
    "0.6 w",
    rect(CARD_X, META_Y, CARD_W, META_H),
    "S",
    rgb(GRID, false),
    "0.35 w",
    line(CARD_X + colW, META_Y, CARD_X + colW, META_Y + META_H),
    line(CARD_X + colW * 2, META_Y, CARD_X + colW * 2, META_Y + META_H),
    textAt(CARD_X + 11.2, META_Y + 22.5, "DATUM", 7.2, true, MUTED),
    textAt(CARD_X + 11.2, META_Y + 8.5, datum, 8, false, CREAM),
    textAt(CARD_X + colW + 11.2, META_Y + 22.5, "STATUS", 7.2, true, MUTED),
    textAt(CARD_X + colW + 11.2, META_Y + 8.5, status, 8, false, CREAM),
    textAt(CARD_X + colW * 2 + 11.2, META_Y + 22.5, "ZEITRAUM", 7.2, true, MUTED),
    textAt(CARD_X + colW * 2 + 11.2, META_Y + 8.5, zeitraum, 8, false, CREAM),
  ];
}

function statsBox(personen: string, positionen: string, gesamtmenge: string): string[] {
  const colW = CARD_W / 3;
  return [
    rgb(PANEL, true),
    rect(CARD_X, META_Y, CARD_W, META_H),
    "f",
    rgb(GOLD_STROKE, false),
    "0.6 w",
    rect(CARD_X, META_Y, CARD_W, META_H),
    "S",
    rgb(GRID, false),
    "0.35 w",
    line(CARD_X + colW, META_Y, CARD_X + colW, META_Y + META_H),
    line(CARD_X + colW * 2, META_Y, CARD_X + colW * 2, META_Y + META_H),
    textAt(CARD_X + 12.2, META_Y + 22.5, "PERSONEN", 7.2, true, MUTED),
    textAt(CARD_X + 12.2, META_Y + 6.5, personen, 14, false, CREAM),
    textAt(CARD_X + colW + 12.2, META_Y + 22.5, "POSITIONEN", 7.2, true, MUTED),
    textAt(CARD_X + colW + 12.2, META_Y + 6.5, positionen, 14, false, CREAM),
    textAt(CARD_X + colW * 2 + 12.2, META_Y + 22.5, "GESAMTMENGE", 7.2, true, MUTED),
    textAt(CARD_X + colW * 2 + 12.2, META_Y + 6.5, gesamtmenge, 14, false, CREAM),
  ];
}

function tableFrame(cols: number[]): string[] {
  const bodyBottom = TABLE_Y + FOOTER_H;
  const headerBottom = TABLE_Y + TABLE_H - HEADER_H;
  const ops: string[] = [
    rgb(PANEL, true),
    rect(CARD_X, bodyBottom, CARD_W, TABLE_H - HEADER_H - FOOTER_H + HEADER_H),
    "f",
    rgb(HEADER_BAR, true),
    rect(CARD_X, headerBottom, CARD_W, HEADER_H),
    "f",
    rgb(HEADER_BAR, true),
    rect(CARD_X, TABLE_Y, CARD_W, FOOTER_H),
    "f",
    rgb(GRID, false),
    "0.45 w",
    rect(CARD_X, TABLE_Y, CARD_W, TABLE_H),
    "S",
  ];
  for (let i = 1; i <= BODY_ROWS; i++) {
    const y = headerBottom - i * ROW_H;
    ops.push(line(CARD_X, y, CARD_X + CARD_W, y));
  }
  ops.push(line(CARD_X, headerBottom, CARD_X + CARD_W, headerBottom));
  ops.push(line(CARD_X, bodyBottom, CARD_X + CARD_W, bodyBottom));
  for (const col of cols.slice(1, -1)) {
    ops.push(line(CARD_X + col, TABLE_Y, CARD_X + col, TABLE_Y + TABLE_H));
  }
  ops.push(rgb(GOLD, false), "1 w", line(CARD_X, headerBottom, CARD_X + CARD_W, headerBottom));
  ops.push("0.75 w", rect(CARD_X, TABLE_Y, CARD_W, FOOTER_H), "S");
  return ops;
}

function cellText(cols: number[], rowY: number, values: string[], size = 8): string[] {
  return values.map((value, index) => {
    const x = CARD_X + cols[index] + 8;
    const max = cols[index + 1] - cols[index] - 14;
    return textAt(x, rowY, fitText(value, size, max, index === 0), size, false, CREAM);
  });
}

function headerCells(cols: number[], labels: string[]): string[] {
  const y = TABLE_Y + TABLE_H - HEADER_H + 7.2;
  return labels.map((label, index) => {
    const x = CARD_X + cols[index] + 8;
    return textAt(x, y, label, 8.2, true, CREAM);
  });
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

const PRODUCT_PAGE_CATEGORIES: Array<{ id: ShopCategoryId; title: string }> = [
  { id: "peptides", title: "PEPTIDE" },
  { id: "injectable-oils", title: "INJECTABLE OILS" },
  { id: "orals", title: "ORALS" },
];

function groupById(groups: OrderSummaryGroup[]): Map<ShopCategoryId, OrderSummaryGroup> {
  return new Map(groups.map((group) => [group.categoryId, group]));
}

function productPages(summary: ProcessingOrderSummary, exportedAt: string): string[] {
  const { datum, zeitraum } = splitExportStamp(exportedAt);
  const byId = groupById(summary.groups);
  const specs = [...PRODUCT_PAGE_CATEGORIES];
  const water = byId.get("reconstitution-water");
  if (water && water.lines.length > 0) {
    specs.push({ id: "reconstitution-water", title: "RECONSTITUTION WATER" });
  }
  const streams: string[] = [];
  let pageNumber = 1;
  for (const spec of specs) {
    const group = byId.get(spec.id);
    const lines = group?.lines ?? [];
    const chunks = chunkRows(lines, BODY_ROWS);
    for (const chunk of chunks) {
      const ops = [
        ...chrome(spec.title, pageNumber, "BESTELLÜBERSICHT • IN BEARBEITUNG"),
        ...metaBox(datum, "In Bearbeitung", zeitraum),
        ...tableFrame(PRODUCT_COLS),
        ...headerCells(PRODUCT_COLS, ["CODE", "ARTIKEL", "MENGE", "GESAMTPREIS"]),
      ];
      chunk.forEach((line: OrderSummaryLine, index) => {
        const y = TABLE_Y + TABLE_H - HEADER_H - (index + 1) * ROW_H + 7;
        ops.push(
          ...cellText(PRODUCT_COLS, y, [line.code, line.name, line.quantityLabel, formatUsd(line.totalUsd)]),
        );
      });
      const footerY = TABLE_Y + 8.2;
      ops.push(
        ...cellText(
          PRODUCT_COLS,
          footerY,
          ["GESAMT", "", String(lines.reduce((sum, line) => sum + line.quantity, 0) || ""), formatUsd(group?.lines.reduce((sum, line) => sum + line.totalUsd, 0) ?? 0)],
          8.2,
        ),
      );
      streams.push(contentStream(ops));
      pageNumber += 1;
    }
  }
  return streams;
}

function orderPages(summary: ProcessingOrderSummary, startPage: number): string[] {
  const chunks = chunkRows(summary.personLines, BODY_ROWS);
  return chunks.map((chunk, index) => {
    const ops = [
      ...chrome("BESTELLUNGEN", startPage + index, "WER HAT WAS BESTELLT UND IN WELCHER MENGE"),
      ...statsBox(String(summary.personCount), String(summary.positionCount), String(summary.personQuantityTotal)),
      ...tableFrame(ORDER_COLS),
      ...headerCells(ORDER_COLS, ["NAME", "MENGE", "DOSIS", "ARTIKEL"]),
    ];
    chunk.forEach((line: OrderSummaryPersonLine, row) => {
      const y = TABLE_Y + TABLE_H - HEADER_H - (row + 1) * ROW_H + 7;
      ops.push(...cellText(ORDER_COLS, y, [line.name, line.quantityLabel, line.dose, line.article]));
    });
    return contentStream(ops);
  });
}

export function buildPeptixOrderSummaryPdf(summary: ProcessingOrderSummary, exportedAt: string): Uint8Array {
  const product = productPages(summary, exportedAt);
  const orders = orderPages(summary, product.length + 1);
  const contents = [...product, ...orders];
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

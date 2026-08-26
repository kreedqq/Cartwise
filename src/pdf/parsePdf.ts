import * as pdfjsLib from "pdfjs-dist";
// Vite can bundle the worker as a URL import; this keeps PDF.js fully
// client-side with no separate CDN dependency (important since GitHub Pages
// has no custom server-side headers to rely on).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** One horizontal run of text on a line, i.e. a table cell candidate. */
export interface PdfCell {
  text: string;
  /** Left edge in PDF text-space units. */
  x: number;
  /** Right edge in PDF text-space units. */
  xEnd: number;
}

/**
 * One visual line of the PDF, split into cells by horizontal gaps. Keeping the
 * x coordinates is what lets the parser align data rows against the table
 * header instead of guessing the layout from a single large regex.
 */
export interface PdfRow {
  text: string;
  cells: PdfCell[];
}

export interface ExtractedPdfText {
  hasTextLayer: boolean;
  pageCount: number;
  /** Flattened line text, kept for the plain-text fallback parser. */
  lines: string[];
  rows: PdfRow[];
}

/** A single positioned text run as reported by pdf.js. */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extracts text from a PDF, grouping text items into lines by their vertical
 * position and into cells by the horizontal gaps between them (pdf.js exposes
 * neither lines nor cells - text items only carry a transform matrix plus a
 * width/height).
 */
export async function extractPdfText(file: File): Promise<ExtractedPdfText> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const rows: PdfRow[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items: PdfTextItem[] = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item)
      .map((item) => {
        const withSize = item as unknown as { width?: number; height?: number };
        return {
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: typeof withSize.width === "number" ? withSize.width : 0,
          height: typeof withSize.height === "number" ? withSize.height : 0,
        };
      })
      .filter((i) => i.str.trim() !== "");

    totalChars += items.reduce((sum, i) => sum + i.str.length, 0);

    // Group by rounded Y (line), tolerant of small sub-pixel differences.
    const lineMap = new Map<number, PdfTextItem[]>();
    for (const item of items) {
      const key = Math.round(item.y / 2) * 2;
      const bucket = lineMap.get(key) ?? [];
      bucket.push(item);
      lineMap.set(key, bucket);
    }

    const sortedLineKeys = Array.from(lineMap.keys()).sort((a, b) => b - a); // top to bottom (PDF y grows upward)
    for (const key of sortedLineKeys) {
      const lineItems = lineMap.get(key)!.sort((a, b) => a.x - b.x);
      const row = groupItemsIntoCells(lineItems);
      if (row.text) rows.push(row);
    }
  }

  return {
    hasTextLayer: totalChars > 0,
    pageCount: pdf.numPages,
    lines: rows.map((r) => r.text),
    rows,
  };
}

/**
 * Splits one line's text items into cells. A gap wider than roughly one
 * character is treated as a column break; narrower gaps are word spacing
 * inside the same cell. The threshold scales with the font height so it works
 * for both body text and small print.
 */
export function groupItemsIntoCells(lineItems: PdfTextItem[]): PdfRow {
  const heights = lineItems.map((i) => i.height).filter((h) => h > 0);
  const referenceHeight = heights.length > 0 ? median(heights) : 10;
  const cellBreakGap = Math.max(2.5, referenceHeight * 0.8);
  const wordGap = Math.max(0.8, referenceHeight * 0.2);

  const cells: PdfCell[] = [];
  let current: PdfCell | null = null;
  let previousEnd = Number.NEGATIVE_INFINITY;

  for (const item of lineItems) {
    const itemEnd = item.x + (item.width || item.str.length * referenceHeight * 0.5);
    const gap = item.x - previousEnd;

    if (current === null || gap > cellBreakGap) {
      if (current) cells.push(current);
      current = { text: item.str.trim(), x: item.x, xEnd: itemEnd };
    } else {
      const needsSpace =
        gap > wordGap && !current.text.endsWith(" ") && !item.str.startsWith(" ") && current.text !== "";
      current.text = `${current.text}${needsSpace ? " " : ""}${item.str}`;
      current.xEnd = Math.max(current.xEnd, itemEnd);
    }
    previousEnd = itemEnd;
  }
  if (current) cells.push(current);

  const normalized = cells
    .map((cell) => ({ ...cell, text: cell.text.replace(/\s+/g, " ").trim() }))
    .filter((cell) => cell.text !== "");

  return {
    text: normalized.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim(),
    cells: normalized,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

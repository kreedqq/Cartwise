import * as pdfjsLib from "pdfjs-dist";
// Vite can bundle the worker as a URL import; this keeps PDF.js fully
// client-side with no separate CDN dependency (important since GitHub Pages
// has no custom server-side headers to rely on).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedPdfText {
  hasTextLayer: boolean;
  pageCount: number;
  lines: string[];
}

/**
 * Extracts text from a PDF, grouping text items into lines by their
 * vertical position (pdf.js does not expose "lines" directly - text items
 * only carry a transform matrix with x/y coordinates).
 */
export async function extractPdfText(file: File): Promise<ExtractedPdfText> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allLines: string[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    type Item = { str: string; x: number; y: number };
    const items: Item[] = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item)
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
      }))
      .filter((i) => i.str.trim() !== "");

    totalChars += items.reduce((sum, i) => sum + i.str.length, 0);

    // Group by rounded Y (line), tolerant of small sub-pixel differences.
    const lineMap = new Map<number, Item[]>();
    for (const item of items) {
      const key = Math.round(item.y / 2) * 2;
      const bucket = lineMap.get(key) ?? [];
      bucket.push(item);
      lineMap.set(key, bucket);
    }

    const sortedLineKeys = Array.from(lineMap.keys()).sort((a, b) => b - a); // top to bottom (PDF y grows upward)
    for (const key of sortedLineKeys) {
      const lineItems = lineMap.get(key)!.sort((a, b) => a.x - b.x);
      const text = lineItems
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) allLines.push(text);
    }
  }

  return {
    hasTextLayer: totalChars > 0,
    pageCount: pdf.numPages,
    lines: allLines,
  };
}

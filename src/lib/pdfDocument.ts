const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

function mapWinAnsi(codePoint: number): number {
  if (codePoint === 0x20ac) return 0x80;
  if (codePoint === 0x201a) return 0x82;
  if (codePoint === 0x0192) return 0x83;
  if (codePoint === 0x201e) return 0x84;
  if (codePoint === 0x2026) return 0x85;
  if (codePoint === 0x2020) return 0x86;
  if (codePoint === 0x2021) return 0x87;
  if (codePoint === 0x02c6) return 0x88;
  if (codePoint === 0x2030) return 0x89;
  if (codePoint === 0x0160) return 0x8a;
  if (codePoint === 0x2039) return 0x8b;
  if (codePoint === 0x0152) return 0x8c;
  if (codePoint === 0x017d) return 0x8e;
  if (codePoint === 0x2018) return 0x91;
  if (codePoint === 0x2019) return 0x92;
  if (codePoint === 0x201c) return 0x93;
  if (codePoint === 0x201d) return 0x94;
  if (codePoint === 0x2022) return 0x95;
  if (codePoint === 0x2013) return 0x96;
  if (codePoint === 0x2014) return 0x97;
  if (codePoint === 0x02dc) return 0x98;
  if (codePoint === 0x2122) return 0x99;
  if (codePoint === 0x0161) return 0x9a;
  if (codePoint === 0x203a) return 0x9b;
  if (codePoint === 0x0153) return 0x9c;
  if (codePoint === 0x017e) return 0x9e;
  if (codePoint === 0x0178) return 0x9f;
  if (codePoint < 128 || (codePoint >= 160 && codePoint <= 255)) return codePoint;
  return 0x3f;
}

function pdfLiteral(text: string): string {
  let out = "(";
  for (const char of text) {
    const mapped = mapWinAnsi(char.codePointAt(0) ?? 63);
    if (mapped === 0x28 || mapped === 0x29 || mapped === 0x5c) {
      out += `\\${String.fromCharCode(mapped)}`;
    } else if (mapped < 32 || mapped > 126) {
      out += `\\${mapped.toString(8).padStart(3, "0")}`;
    } else {
      out += String.fromCharCode(mapped);
    }
  }
  return `${out})`;
}

function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxChars) {
      for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
      current = "";
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

interface PdfLine {
  text: string;
  size: number;
  bold: boolean;
}

function paginate(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;
  for (const line of lines) {
    const height = line.size + 4;
    if (y - height < MARGIN) {
      pages.push([]);
      y = PAGE_HEIGHT - MARGIN;
    }
    pages[pages.length - 1].push(line);
    y -= height;
  }
  return pages;
}

function pageContentStream(lines: PdfLine[]): string {
  const ops = ["BT"];
  let first = true;
  let y = PAGE_HEIGHT - MARGIN;
  for (const line of lines) {
    ops.push(`/${line.bold ? "F2" : "F1"} ${line.size} Tf`);
    if (first) {
      ops.push(`${MARGIN} ${y} Td`);
      first = false;
    } else {
      ops.push(`0 ${-(line.size + 4)} Td`);
    }
    ops.push(`${pdfLiteral(line.text)} Tj`);
    y -= line.size + 4;
  }
  ops.push("ET");
  return ops.join("\n");
}

const encoder = new TextEncoder();

function assemblePdf(objectBodies: string[]): Uint8Array {
  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
  let offset = chunks[0].length;
  const offsets = [0];

  for (let i = 0; i < objectBodies.length; i++) {
    offsets.push(offset);
    const bytes = encoder.encode(`${i + 1} 0 obj\n${objectBodies[i]}\nendobj\n`);
    chunks.push(bytes);
    offset += bytes.length;
  }

  const xrefStart = offset;
  const xrefLines = ["xref", `0 ${objectBodies.length + 1}`, "0000000000 65535 f "];
  for (let i = 1; i <= objectBodies.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const xrefBlock = encoder.encode(`${xrefLines.join("\n")}\n`);
  chunks.push(xrefBlock);

  chunks.push(
    encoder.encode(`trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`),
  );

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

export function buildSimplePdf(sections: Array<{ title?: string; lines: string[] }>): Uint8Array {
  const lines: PdfLine[] = [];
  for (const section of sections) {
    if (section.title) lines.push({ text: section.title, size: 13, bold: true });
    for (const line of section.lines) {
      for (const wrapped of wrapText(line, 92)) {
        lines.push({ text: wrapped, size: 10, bold: false });
      }
    }
    lines.push({ text: " ", size: 8, bold: false });
  }
  if (lines.length === 0) {
    lines.push({ text: "Keine Bestellungen in Bearbeitung", size: 10, bold: false });
  }

  const pages = paginate(lines);
  const contentBodies = pages.map((page) => {
    const stream = pageContentStream(page);
    return `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  const pageObjectStart = 5 + contentBodies.length;
  const pageRefs = contentBodies.map((_, index) => `${pageObjectStart + index} 0 R`).join(" ");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs}] /Count ${contentBodies.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ...contentBodies,
    ...contentBodies.map((_, index) => {
      const contentObject = 5 + index;
      return `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentObject} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    }),
  ];
  return assemblePdf(objects);
}

export function downloadPdf(filename: string, bytes: Uint8Array): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function pdfStartsWithHeader(bytes: Uint8Array): boolean {
  const header = "%PDF-";
  if (bytes.length < header.length) return false;
  for (let i = 0; i < header.length; i++) {
    if (bytes[i] !== header.charCodeAt(i)) return false;
  }
  return true;
}

export function pdfContainsAscii(bytes: Uint8Array, needle: string): boolean {
  const text = new TextDecoder("latin1").decode(bytes);
  return text.includes(needle);
}

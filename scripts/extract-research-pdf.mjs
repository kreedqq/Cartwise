/**
 * One-off script: extract text from PEPTIX research PDF and parse product profiles.
 * Usage: node scripts/extract-research-pdf.mjs [pdfPath]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");

const pdfPath =
  process.argv[2] ??
  "C:/Users/PolatMehmetErkan/Downloads/PEPTIX_Complete_Product_Research_2026.pdf";

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

const allLines = [];

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const items = content.items
    .filter((item) => "str" in item && item.str.trim())
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
    }));

  const lineMap = new Map();
  for (const item of items) {
    const key = Math.round(item.y / 2) * 2;
    const bucket = lineMap.get(key) ?? [];
    bucket.push(item);
    lineMap.set(key, bucket);
  }

  const sortedKeys = [...lineMap.keys()].sort((a, b) => b - a);
  for (const key of sortedKeys) {
    const lineItems = lineMap.get(key).sort((a, b) => a.x - b.x);
    const text = lineItems.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    if (text) allLines.push({ page: pageNum, text });
  }
}

const fullText = allLines.map((l) => l.text).join("\n");
fs.mkdirSync("scripts/output", { recursive: true });
fs.writeFileSync("scripts/output/research-pdf-lines.txt", fullText, "utf8");

// Profile detection heuristics
const SECTION_HEADERS = [
  "Kurz erklärt",
  "Wofür wird es verwendet bzw. untersucht?",
  "Mögliche Vorteile",
  "Mögliche Nachteile / Nebenwirkungen",
  "Anwendung / Darreichungsform",
  "Aktuelle Studienlage",
  "Evidenzstatus",
  "Zulassungsstatus",
  "Katalogvarianten",
];

const evidenceRe = /\bEvidenzstatus\s+([ABCDU])\b/i;
const profileStartRe =
  /^(?:PEPTIDES|INJECTABLES|ORALS|PEPTIDES-OILS|INJECTABLES-OILS|ORALS)\s*$/i;

const profiles = [];
let current = null;
let currentSection = null;
let sectionBuffer = [];

function flushSection() {
  if (!current || !currentSection) return;
  const text = sectionBuffer.join("\n").trim();
  if (text) current.sections[currentSection] = text;
  sectionBuffer = [];
}

function flushProfile() {
  if (!current) return;
  flushSection();
  profiles.push(current);
  current = null;
  currentSection = null;
  sectionBuffer = [];
}

for (const { page, text } of allLines) {
  // New profile: ALL CAPS product name line (not a section header)
  const isSection = SECTION_HEADERS.some((h) => text === h || text.startsWith(h));
  if (isSection) {
    flushSection();
    currentSection = SECTION_HEADERS.find((h) => text.startsWith(h)) ?? text;
    continue;
  }

  const evMatch = text.match(/^Evidenzstatus\s+([ABCDU])\s*$/i);
  if (evMatch && current) {
    flushSection();
    current.evidenceGrade = evMatch[1].toUpperCase();
    currentSection = "Evidenzstatus";
    continue;
  }

  // Detect profile title: standalone line, not too long, often before "Kurz erklärt"
  if (
    !current &&
    text.length >= 3 &&
    text.length <= 80 &&
    !text.includes(":") &&
    !/^Seite\s+\d+/i.test(text) &&
    !/^PEPTIX/i.test(text) &&
    !/^Wissenschaftliche/i.test(text) &&
    !/^Katalog/i.test(text) &&
    !/^Inhalts/i.test(text) &&
    !/^Evidenzstufen/i.test(text) &&
    !/^\d+$/.test(text) &&
    !profileStartRe.test(text)
  ) {
    // peek next lines for Kurz erklärt within 5 lines - handled separately
  }

  if (current && currentSection) {
    sectionBuffer.push(text);
  }
}

// Simpler pass: split by "Kurz erklärt" blocks
const blocks = fullText.split(/(?=\nKurz erklärt\n)/);
console.log(JSON.stringify({
  pageCount: pdf.numPages,
  lineCount: allLines.length,
  charCount: fullText.length,
  blockCount: blocks.length,
  sampleLines: allLines.slice(0, 30).map((l) => l.text),
}, null, 2));

console.log("\nWrote scripts/output/research-pdf-lines.txt");

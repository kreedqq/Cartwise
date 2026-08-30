/**
 * Parse PEPTIX_Complete_Product_Research_2026.pdf into structured JSON profiles.
 * Usage: node scripts/parse-research-pdf.mjs [linesFile]
 */
import fs from "node:fs";

const linesFile = process.argv[2] ?? "scripts/output/research-pdf-lines.txt";
const fullText = fs.readFileSync(linesFile, "utf8");
const lines = fullText.split(/\r?\n/);

const SECTION_MARKERS = [
  { key: "shortDescription", label: "Kurz erklärt" },
  { key: "uses", label: "Wofür wird es verwendet bzw. untersucht?" },
  { key: "benefits", label: "Mögliche Vorteile" },
  { key: "risks", label: "Mögliche Nachteile / Nebenwirkungen" },
  { key: "administration", label: "Anwendung / Darreichungsform" },
  { key: "evidence", label: "Aktuelle Studienlage" },
];

const CATEGORY_MAP = {
  PEPTIDES: "PEPTIDES",
  "INJECTABLES / OILS": "OILS / INJECTABLES",
  "INJECTABLES-OILS": "OILS / INJECTABLES",
  ORALS: "ORALS",
};

function isCategoryLine(line) {
  return line in CATEGORY_MAP;
}

function shouldSkipNameLine(line) {
  const t = line?.trim() ?? "";
  if (!t) return true;
  if (isCategoryLine(t)) return true;
  if (/^PEPTIX Complete Product Research/i.test(t)) return true;
  if (/^Seite \d+/i.test(t)) return true;
  if (/^(PEPTIX$|Complete Product Research|Wissenschaftliche|Erstellt aus|und zu 201|Wirkstoffs|nachvollziehbar|Wichtiger Hinweis|Therapieempfehlung|identifizierten|deshalb klar|^\d+\.|Umfang und|Der zugrunde|Produktnamen|Kategorie Katalog|Evidenzstufen)/i.test(t)) return true;
  return false;
}

function parseCatalogVariants(text) {
  const variants = [];
  const re = /([A-Z0-9]+)\s*\(([^;)]+)(?:;\s*(AVAILABLE|OUT OF STOCK))?\)/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    variants.push({
      code: match[1].toUpperCase(),
      rawVariant: match[2].trim(),
      status: match[3]?.replace(/\s+/g, " ") ?? null,
    });
  }
  return variants;
}

function formatVariantLabel(raw) {
  const kitMatch = /x\s*(\d+)\s*vials?/i.exec(raw);
  const kitSize = kitMatch ? Number(kitMatch[1]) : null;
  const strengthMatch = /^([\d.,]+\s*(?:mg|mcg|iu|ui|ml))\b/i.exec(raw.trim());
  const strength = strengthMatch
    ? strengthMatch[1].replace(/\s+/g, " ").replace(/(\d)(mg|mcg|iu|ui|ml)/i, "$1 $2")
    : raw.trim();
  if (kitSize && strength) return `${kitSize}x ${strength} Vials`;
  return strength;
}

function parseEvidenceLine(trimmed) {
  const match = trimmed.match(/^Evidenzstatus:\s*([ABCDU](?:\s+bis\s+[ABCDU])?)\s+Zulassungsstatus:\s*(.*)$/i);
  if (!match) return null;
  return {
    evidenceGrade: match[1].replace(/\s+/g, " ").trim(),
    approvalStatus: match[2].trim(),
  };
}

/** Match profile name against PDF product label (e.g. "Clenbuterol" ↔ "CLENBUTEROL"). */
function productNameMatches(profileName, pdfProductLabel) {
  const norm = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const a = norm(profileName);
  const b = norm(pdfProductLabel);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * PDF sometimes combines two beta-agonist profiles on one evidence line, e.g.:
 * Evidenzstatus: A für Salbutamol; D für Clenbuterol als Fitnessmittel
 * Zulassungsstatus: Salbutamol zugelassen; Clenbuterol nicht als reguläres Humanarzneimittel …
 */
function extractProductSpecificEvidence(profile) {
  const tail = profile.evidence ?? "";
  const blockMatch = tail.match(/Evidenzstatus:\s*([\s\S]+?)\s+Zulassungsstatus:\s*([\s\S]+)$/i);
  if (!blockMatch) return null;

  const evPart = blockMatch[1].trim();
  const approvalPart = blockMatch[2].replace(/\s+/g, " ").trim();

  const gradeRules = [...evPart.matchAll(/([ABCDU])\s+für\s+([^;]+)/gi)];
  let evidenceGrade = null;
  for (const [, grade, label] of gradeRules) {
    if (productNameMatches(profile.name, label)) {
      evidenceGrade = grade.toUpperCase();
      break;
    }
  }

  if (!evidenceGrade) return null;

  let approvalStatus = approvalPart;
  const approvalSegments = approvalPart.split(/\s*;\s*/);
  for (const segment of approvalSegments) {
    const trimmed = segment.trim();
    const firstWord = trimmed.split(/\s+/)[0] ?? "";
    if (productNameMatches(profile.name, firstWord)) {
      approvalStatus = trimmed;
      break;
    }
  }

  return {
    evidenceGrade,
    approvalStatus,
    cleanedEvidence: tail.replace(/\s*Evidenzstatus:[\s\S]*$/i, "").trim(),
  };
}

const profiles = [];
let currentCategory = "PEPTIDES";
let i = 0;

while (i < lines.length) {
  const line = lines[i].trim();

  if (isCategoryLine(line)) {
    currentCategory = CATEGORY_MAP[line];
    i++;
    continue;
  }

  if (!line.startsWith("Katalogvarianten:")) {
    i++;
    continue;
  }

  let nameIdx = i - 1;
  while (nameIdx >= 0 && shouldSkipNameLine(lines[nameIdx])) nameIdx--;
  const name = lines[nameIdx]?.trim() ?? "Unknown";

  let variantText = line.replace(/^Katalogvarianten:\s*/, "");
  i++;
  while (i < lines.length && !lines[i].trim().startsWith("Kurz erklärt")) {
    variantText += ` ${lines[i].trim()}`;
    i++;
  }

  const catalogVariants = parseCatalogVariants(variantText).map((v) => ({
    ...v,
    displayLabel: formatVariantLabel(v.rawVariant),
  }));

  const sections = Object.fromEntries(SECTION_MARKERS.map((s) => [s.key, ""]));
  let evidenceGrade = null;
  let approvalStatus = null;
  let currentSection = null;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith("Katalogvarianten:")) break;
    if (isCategoryLine(trimmed)) break;

    const section = SECTION_MARKERS.find((s) => trimmed === s.label);
    if (section) {
      currentSection = section.key;
      i++;
      continue;
    }

    const ev = parseEvidenceLine(trimmed);
    if (ev) {
      evidenceGrade = ev.evidenceGrade;
      approvalStatus = ev.approvalStatus;
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next || next.startsWith("Katalogvarianten:") || isCategoryLine(next) || SECTION_MARKERS.some((s) => s.label === next)) break;
        if (/^PEPTIX Complete Product Research/i.test(next)) {
          i++;
          continue;
        }
        if (/^Evidenzstatus:/i.test(next)) break;
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith("Katalogvarianten:")) break;
        approvalStatus = `${approvalStatus} ${next}`.trim();
        i++;
      }
      break;
    }

    if (/^Evidenzstatus:/i.test(trimmed)) {
      if (currentSection === "evidence") {
        sections.evidence += (sections.evidence ? "\n" : "") + trimmed;
      }
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next || next.startsWith("Katalogvarianten:") || isCategoryLine(next) || SECTION_MARKERS.some((s) => s.label === next)) break;
        if (/^PEPTIX Complete Product Research/i.test(next)) {
          i++;
          continue;
        }
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith("Katalogvarianten:")) break;
        sections.evidence += `\n${next}`;
        i++;
      }
      break;
    }

    if (/^PEPTIX Complete Product Research/i.test(trimmed)) {
      i++;
      continue;
    }

    if (currentSection) {
      sections[currentSection] += (sections[currentSection] ? "\n" : "") + trimmed;
    }
    i++;
  }

  profiles.push({
    name,
    category: currentCategory,
    catalogVariants,
    evidenceGrade,
    approvalStatus,
    ...sections,
  });
}

for (const profile of profiles) {
  if (!profile.evidenceGrade) {
    const specific = extractProductSpecificEvidence(profile);
    if (specific) {
      profile.evidenceGrade = specific.evidenceGrade;
      profile.approvalStatus = specific.approvalStatus;
      profile.evidence = specific.cleanedEvidence;
      continue;
    }
  }

  if (profile.evidenceGrade) continue;
  const tail = profile.evidence ?? "";
  const match = tail.match(/Evidenzstatus:\s*([ABCDU](?:\s+bis\s+[ABCDU])?|A[^Z\n]{0,40})\s+Zulassungsstatus:\s*([\s\S]+)$/i);
  if (match) {
    profile.evidenceGrade = match[1].replace(/\s+/g, " ").trim();
    profile.approvalStatus = match[2].replace(/\s+/g, " ").trim();
    profile.evidence = tail.replace(/\s*Evidenzstatus:[\s\S]*$/i, "").trim();
  }
  if (profile.approvalStatus) {
    profile.approvalStatus = profile.approvalStatus.replace(/\s+[A-Z][A-Za-z0-9 ()+-]+$/, "").trim();
  }
}

const outDir = "src/lib/peptide/lexiconV2/pdfResearch";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/profiles.json`, JSON.stringify(profiles, null, 2), "utf8");

const byGrade = profiles.reduce((acc, p) => {
  const g = p.evidenceGrade ?? "?";
  acc[g] = (acc[g] ?? 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify(
    {
      profileCount: profiles.length,
      missingEvidence: profiles.filter((p) => !p.evidenceGrade).length,
      byGrade,
      categories: {
        PEPTIDES: profiles.filter((p) => p.category === "PEPTIDES").length,
        "OILS / INJECTABLES": profiles.filter((p) => p.category === "OILS / INJECTABLES").length,
        ORALS: profiles.filter((p) => p.category === "ORALS").length,
      },
    },
    null,
    2,
  ),
);

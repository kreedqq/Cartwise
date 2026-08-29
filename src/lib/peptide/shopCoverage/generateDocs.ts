import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { coverageReportSummary, shopCoverageMatrix } from "@/lib/peptide/shopCoverage/coverage";
import type { ShopCoverageRow } from "@/lib/peptide/shopCoverage/types";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function rowsToCsv(rows: readonly ShopCoverageRow[]): string {
  const header = [
    "code",
    "product_name",
    "shop_category_db",
    "coverage_category",
    "substance",
    "family_slug",
    "research_slug",
    "variant",
    "lexicon_profile_required",
    "mapping_unique",
    "status",
    "reason",
  ];
  const lines = rows.map((row) =>
    [
      row.code,
      row.name,
      row.shopCategory ?? "",
      row.coverageCategory,
      row.substance,
      row.familySlug ?? "",
      row.researchSlug ?? "",
      row.variant,
      row.lexiconProfileRequired,
      row.mappingUnique,
      row.status,
      row.reason,
    ]
      .map((value) => csvEscape(String(value)))
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function rowsToMarkdown(rows: readonly ShopCoverageRow[], summary: ReturnType<typeof coverageReportSummary>): string {
  const generated = new Date().toISOString().slice(0, 10);
  const ambiguousList = summary.ambiguousProducts
    .map((row) => `- **${row.code}** · ${row.name} · ${row.status} · ${row.reason}`)
    .join("\n");

  const categoryLines = Object.entries(summary.categoryCounts)
    .sort(([a], [b]) => a.localeCompare(b, "de"))
    .map(([key, count]) => `- ${key}: **${count}**`)
    .join("\n");

  const tableHeader =
    "| Code | Produkt | Kategorie | Wirkstoff | Variante | Profil nötig | Mapping eindeutig | Status | Grund |\n|---|---|---|---|---|---|---|---|---|";
  const tableRows = rows
    .map(
      (row) =>
        `| ${row.code} | ${row.name.replace(/\|/g, "\\|")} | ${row.coverageCategory} | ${row.substance.replace(/\|/g, "\\|")} | ${row.variant.replace(/\|/g, "\\|")} | ${row.lexiconProfileRequired} | ${row.mappingUnique} | ${row.status} | ${row.reason.replace(/\|/g, "\\|")} |`,
    )
    .join("\n");

  return `# Lexikon Shop Coverage Matrix

Generiert: **${generated}**  
Quelle: \`products\` (Production Dump 0031) + \`LIVE_SHOP_PRODUCTS\` (320 SKUs)  
Regeln: exakte Namensgruppen, \`postgresMappingSlug\`, keine Fuzzy-Mappings, getrennte Identitäten (TB-500 ≠ Thymosin Beta-4, MT-II ≠ Afamelanotid, IGF-1 LR3 ≠ Mecasermin, urinary hCG ≠ Ovitrelle).

## Zusammenfassung

| Kennzahl | Wert |
|---|---:|
| Shopprodukte gesamt | ${summary.shopProductsTotal} |
| Eindeutig gemappt | ${summary.uniquelyMapped} |
| Mehrere Varianten (SKUs) | ${summary.multiVariantProducts} |
| Varianten-Familien | ${summary.multiVariantFamilies} |
| Neue Lexikonprofile erforderlich | ${summary.newLexiconProfilesRequired} |
| COMPLETE (27 Research-Identitäten) | ${summary.complete} |
| PARTIAL | ${summary.partial} |
| Review Required | ${summary.reviewRequired} |
| Unknown | ${summary.unknown} |
| Non-Lexicon | ${summary.nonLexicon} |

## Kategorien

${categoryLines}

## Produkte ohne eindeutige Zuordnung (${summary.ambiguousProducts.length})

${ambiguousList || "_Keine_"}

## Vollständige Matrix

${tableHeader}
${tableRows}
`;
}

export function generateLexiconShopCoverageDocs(rootDir: string = process.cwd()): {
  csvPath: string;
  mdPath: string;
  summary: ReturnType<typeof coverageReportSummary>;
} {
  const rows = shopCoverageMatrix();
  const summary = coverageReportSummary(rows);
  const csvPath = resolve(rootDir, "docs/LEXICON_SHOP_COVERAGE.csv");
  const mdPath = resolve(rootDir, "docs/LEXICON_SHOP_COVERAGE.md");

  writeFileSync(csvPath, `${rowsToCsv(rows)}\n`, "utf8");
  writeFileSync(mdPath, `${rowsToMarkdown(rows, summary)}\n`, "utf8");

  return { csvPath, mdPath, summary };
}

export function coverageReportText(summary: ReturnType<typeof coverageReportSummary>): string {
  return [
    `Shopprodukte gesamt: ${summary.shopProductsTotal}`,
    `Eindeutig gemappt: ${summary.uniquelyMapped}`,
    `Mehrere Varianten: ${summary.multiVariantProducts}`,
    `Neue Lexikonprofile erforderlich: ${summary.newLexiconProfilesRequired}`,
    `Review Required: ${summary.reviewRequired}`,
    `Unknown: ${summary.unknown}`,
    `Non-Lexicon: ${summary.nonLexicon}`,
  ].join("\n");
}

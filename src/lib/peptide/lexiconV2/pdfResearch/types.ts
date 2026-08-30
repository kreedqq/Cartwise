import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

export interface PdfCatalogVariant {
  code: string;
  rawVariant: string;
  displayLabel: string;
  status: string | null;
}

export interface PdfResearchProfile {
  name: string;
  category: ShopCoverageCategory;
  catalogVariants: PdfCatalogVariant[];
  evidenceGrade: string | null;
  approvalStatus: string | null;
  shortDescription: string;
  uses: string;
  benefits: string;
  risks: string;
  administration: string;
  evidence: string;
}

export type PdfEvidenceGrade = "A" | "B" | "C" | "D" | "U";

export const PDF_EVIDENCE_LABELS: Record<PdfEvidenceGrade, string> = {
  A: "Etablierte zugelassene medizinische Anwendung",
  B: "Gute klinische Humanstudien, Entwicklung oder begrenzte Zulassung",
  C: "Frühe oder begrenzte Humanforschung",
  D: "Überwiegend Tier-, Zell- oder theoretische Forschung",
  U: "Identität oder Zusammensetzung nicht ausreichend verifizierbar",
};

/** Primary letter from PDF grades like "C bis D" or "A bis C". */
export function primaryPdfEvidenceGrade(grade: string | null): PdfEvidenceGrade | null {
  if (!grade) return null;
  const match = grade.trim().match(/^([ABCDU])/i);
  return match ? (match[1].toUpperCase() as PdfEvidenceGrade) : null;
}

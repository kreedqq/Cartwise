import type { PeptideCategory } from "@/lib/peptide/types";

export const LEXICON_STATUS_FILTERS = [
  { id: "all", label: "Alle Status" },
  { id: "approved", label: "Approved" },
  { id: "clinical-trial", label: "Clinical Trial" },
  { id: "investigational", label: "Investigational" },
  { id: "preclinical", label: "Preclinical" },
  { id: "limited-data", label: "Limited Data" },
] as const;

export type LexiconStatusFilter = (typeof LEXICON_STATUS_FILTERS)[number]["id"];

export function matchesLexiconStatus(
  item: { evidenceLevel: string; regulatoryStatus: string },
  filter: LexiconStatusFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "approved") return item.regulatoryStatus === "approved" || item.regulatoryStatus === "approved-specific";
  if (filter === "clinical-trial") return item.regulatoryStatus === "clinical-development";
  if (filter === "investigational") return item.regulatoryStatus === "investigational";
  if (filter === "preclinical") return item.evidenceLevel === "D";
  return item.evidenceLevel === "E" || item.evidenceLevel === "F" || item.regulatoryStatus === "insufficient";
}

export function matchesLexiconCategory(
  item: { category: PeptideCategory | string },
  category: PeptideCategory | "all",
): boolean {
  return category === "all" || item.category === category;
}

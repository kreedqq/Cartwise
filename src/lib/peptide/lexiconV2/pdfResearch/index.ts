import profilesJson from "./profiles.json";
import type { PdfResearchProfile } from "./types";

export const PDF_RESEARCH_PROFILES = profilesJson as PdfResearchProfile[];

export function listPdfResearchProfiles(): PdfResearchProfile[] {
  return PDF_RESEARCH_PROFILES;
}

export function getPdfResearchProfileByName(name: string): PdfResearchProfile | undefined {
  const normalized = name.trim().toLowerCase();
  return PDF_RESEARCH_PROFILES.find((p) => p.name.trim().toLowerCase() === normalized);
}

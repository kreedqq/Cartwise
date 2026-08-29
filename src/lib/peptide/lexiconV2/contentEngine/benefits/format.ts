import { INSUFFICIENT_DATA_DE } from "@/lib/peptide/lexiconV2/contentEngine/constants";
import type { BenefitEvidenceTier, BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

export function bp(
  slug: string,
  parts: {
    w?: string[];
    p?: string[];
    c?: string[];
    note?: string;
  },
): BenefitsProfile {
  return {
    slug,
    wellEstablished: parts.w ?? [],
    possible: parts.p ?? [],
    preclinical: parts.c ?? [],
    specificEvidenceNote: parts.note,
  };
}

export function formatBenefitsDe(profile: BenefitsProfile): string {
  const sections: string[] = [];

  if (profile.wellEstablished.length > 0) {
    sections.push(
      "Gut belegt:\n" + profile.wellEstablished.map((item) => `• ${item}`).join("\n"),
    );
  }
  if (profile.possible.length > 0) {
    sections.push(
      "Mögliche Vorteile:\n" + profile.possible.map((item) => `• ${item}`).join("\n"),
    );
  }
  if (profile.preclinical.length > 0) {
    sections.push(
      "Präklinische Hinweise:\n" + profile.preclinical.map((item) => `• ${item}`).join("\n"),
    );
  }

  if (sections.length === 0) {
    if (profile.specificEvidenceNote) {
      return profile.specificEvidenceNote;
    }
    return profile.specificEvidenceNote ?? "";
  }

  let text = sections.join("\n\n");

  if (profile.preclinical.length > 0 && profile.wellEstablished.length === 0 && profile.possible.length === 0) {
    text +=
      "\n\nOb sich diese präklinischen Befunde auf den Menschen übertragen lassen, ist derzeit nicht ausreichend geklärt.";
  }

  if (profile.specificEvidenceNote) {
    text += `\n\n${profile.specificEvidenceNote}`;
  }

  return text;
}

export function hasPositiveEffects(profile: BenefitsProfile): boolean {
  return (
    profile.wellEstablished.length > 0 ||
    profile.possible.length > 0 ||
    profile.preclinical.length > 0
  );
}

export function primaryBenefitTier(profile: BenefitsProfile): BenefitEvidenceTier {
  if (profile.wellEstablished.length > 0) return "wellEstablished";
  if (profile.possible.length > 0) return "possible";
  if (profile.preclinical.length > 0) return "preclinical";
  return "none";
}

const GENERIC_BENEFIT_PATTERNS = [
  /^Die aktuelle Datenlage reicht nicht aus/i,
  /^Für die Blend-Mischung als Ganzes liegen keine belastbaren Humanstudien vor\. Aussagen zu Einzelkomponenten dürfen nicht automatisch auf die Mischung übertragen werden\./i,
  /^In zugelassenen Indikationen wurden Nutzen in kontrollierten Humanstudien und postmarketing-Daten beschrieben\./i,
  /^In zugelassenen Indikationen wurden Nutzen in kontrollierten Humanstudien beschrieben\./i,
  /^Keine belastbaren Vorteile/i,
  /^Keine Vorteile bekannt/i,
  /^Es liegen keine belastbaren Humanstudien vor\.?$/i,
];

export function isGenericBenefitsText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed === INSUFFICIENT_DATA_DE) return true;
  if (trimmed.endsWith(INSUFFICIENT_DATA_DE) && trimmed.length < 220) return true;
  return GENERIC_BENEFIT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

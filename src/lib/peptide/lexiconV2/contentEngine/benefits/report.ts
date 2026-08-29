import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import {
  getBenefitsProfile,
  hasPositiveEffects,
  isGenericBenefitsText,
  primaryBenefitTier,
} from "@/lib/peptide/lexiconV2/contentEngine/benefits";
import type { BenefitsReport, BenefitsReportEntry } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

export function buildBenefitsReport(): BenefitsReport {
  const catalog = buildPublicLexiconV2Catalog();

  const withSupportedPositiveEffects: BenefitsReportEntry[] = [];
  const withHumanEvidence: BenefitsReportEntry[] = [];
  const preclinicalOnly: BenefitsReportEntry[] = [];
  const withoutAdequatePositiveEffects: BenefitsReportEntry[] = [];

  for (const entry of catalog.entries) {
    const profile =
      getBenefitsProfile(entry.slug, entry.blendComponentSlugs) ??
      ({
        slug: entry.slug,
        wellEstablished: [],
        possible: [],
        preclinical: [],
        specificEvidenceNote: undefined,
      } as const);

    const tier = primaryBenefitTier(profile);
    const hasCatalogPositive = hasPositiveEffects(profile);
    const publicText = entry.possibleBenefitsDe;
    const hasPublicPositive = !isGenericBenefitsText(publicText) && publicText.trim().length > 20;

    const reportEntry: BenefitsReportEntry = {
      slug: entry.slug,
      displayNameDe: entry.displayNameDe,
      tier,
    };

    if (hasCatalogPositive || hasPublicPositive) {
      withSupportedPositiveEffects.push(reportEntry);
    }

    if (tier === "wellEstablished" || tier === "possible") {
      withHumanEvidence.push(reportEntry);
    } else if (tier === "preclinical") {
      preclinicalOnly.push(reportEntry);
    } else {
      withoutAdequatePositiveEffects.push({
        ...reportEntry,
        reason: profile.specificEvidenceNote ?? publicText.slice(0, 200),
      });
    }
  }

  return {
    withSupportedPositiveEffects,
    withHumanEvidence,
    preclinicalOnly,
    withoutAdequatePositiveEffects,
  };
}

export function formatBenefitsReportDe(report: BenefitsReport): string {
  const lines: string[] = [
    "=== VORTEILSREPORT ===",
    "",
    `Profile mit mindestens einem wissenschaftlich gestützten positiven Effekt: ${report.withSupportedPositiveEffects.length}`,
    report.withSupportedPositiveEffects.map((e) => e.displayNameDe).join(", "),
    "",
    `Profile mit Human-Evidenz für positive Effekte: ${report.withHumanEvidence.length}`,
    report.withHumanEvidence.map((e) => e.displayNameDe).join(", "),
    "",
    `Profile nur mit präklinischen positiven Effekten: ${report.preclinicalOnly.length}`,
    report.preclinicalOnly.map((e) => e.displayNameDe).join(", "),
    "",
    `Profile ohne ausreichend belegte positive Effekte: ${report.withoutAdequatePositiveEffects.length}`,
  ];

  for (const entry of report.withoutAdequatePositiveEffects) {
    lines.push(`- ${entry.displayNameDe} (${entry.slug}): ${entry.reason ?? "Keine belastbare Evidenz identifiziert."}`);
  }

  return lines.join("\n");
}

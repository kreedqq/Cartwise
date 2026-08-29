export type BenefitEvidenceTier = "wellEstablished" | "possible" | "preclinical" | "none";

export interface BenefitsProfile {
  slug: string;
  /** Positive effects supported by strong human studies (approved indications or robust RCTs). */
  wellEstablished: string[];
  /** Positive effects with limited, mixed, or context-specific human evidence. */
  possible: string[];
  /** Positive effects from animal or cell studies only. */
  preclinical: string[];
  /**
   * When no positive effects could be identified with adequate sources.
   * Must be substance-specific — never a generic placeholder.
   */
  specificEvidenceNote?: string;
}

export interface BenefitsReportEntry {
  slug: string;
  displayNameDe: string;
  tier: BenefitEvidenceTier;
  reason?: string;
}

export interface BenefitsReport {
  withSupportedPositiveEffects: BenefitsReportEntry[];
  withHumanEvidence: BenefitsReportEntry[];
  preclinicalOnly: BenefitsReportEntry[];
  withoutAdequatePositiveEffects: BenefitsReportEntry[];
}

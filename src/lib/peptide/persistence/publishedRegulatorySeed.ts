import { inferRegulatoryAuthority } from "@/lib/peptide/persistence/identifiers";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import type { ProfileSource, SubstanceProfile } from "@/lib/peptide/profiles/types";
import type { RegulatoryStatus } from "@/lib/peptide/types";

export type RegulatoryAuthority = "fda" | "ema" | "bfarm" | "mhra" | "nmpa" | "other";
export type RegulatoryRegion = "US" | "EU" | "UK" | "JP" | "CN" | "unspecified";
export type PersistedRegulatoryStatus =
  | "approved"
  | "approved_specific_indication"
  | "clinical_development"
  | "investigational"
  | "not_approved"
  | "insufficient_information"
  | "unknown";

export type ReviewActionName = "approve" | "reject" | "request_review" | "edit" | "publish" | "unpublish";
export type ReviewEntityType = "claim" | "evidence_assessment" | "regulatory_record" | "research_update" | "substance";
export type ReviewWorkflowStatus = "draft" | "review-required" | "approved" | "rejected";
export type ReconcileStatus = "MATCH" | "MISSING_IN_POSTGRES" | "MISSING_IN_JSON" | "DIFFERENT" | "UNRESOLVED";

export interface SeedRegulatoryRecord {
  stableKey: string;
  substanceSlug: string;
  authority: RegulatoryAuthority;
  region: RegulatoryRegion;
  status: PersistedRegulatoryStatus;
  indication: string | null;
  productName: string | null;
  applicationId: string | null;
  legacySourceId: string;
  effectiveDate: string | null;
  lastChecked: string | null;
  isCurrent: boolean;
  note: string | null;
  reviewStatus: ReviewWorkflowStatus;
}

export interface SeedReviewAction {
  entityType: ReviewEntityType;
  entityStableKey: string;
  action: ReviewActionName;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string;
}

export interface SeedReconcileRow {
  status: ReconcileStatus;
  jsonRef: string;
  postgresRef: string;
  note: string;
}

export interface PublishedRegulatorySeed {
  records: SeedRegulatoryRecord[];
  history: never[];
  reviewActions: SeedReviewAction[];
  reconciliation: SeedReconcileRow[];
}

export function mapOverlayRegulatoryStatus(status: RegulatoryStatus): PersistedRegulatoryStatus {
  if (status === "approved") return "approved";
  if (status === "approved-specific") return "approved_specific_indication";
  if (status === "clinical-development") return "clinical_development";
  if (status === "investigational") return "investigational";
  if (status === "not-approved") return "not_approved";
  if (status === "insufficient") return "insufficient_information";
  return "unknown";
}

export function productNameFromRegulatoryTitle(title: string): string | null {
  if (/no product match/i.test(title) || /no blend NDA searched/i.test(title)) return null;
  const epar = /^(.*?)\s+EPAR\b/i.exec(title);
  if (epar) return epar[1].trim();
  const fda = /^(.*?)\s+FDA prescribing information/i.exec(title);
  if (fda) return fda[1].trim();
  return null;
}

function isNoMatchSource(source: ProfileSource): boolean {
  return /no product match/i.test(source.title) || /no blend NDA searched/i.test(source.title);
}

function isOvitrelleRelated(source: ProfileSource): boolean {
  return source.id === "ema-ovitrelle" || /not urinary hCG/i.test(source.title);
}

function applicationIdFromPublishedNote(
  profile: SubstanceProfile,
  source: ProfileSource,
): string | null {
  const note = profile.identity.identityNote ?? "";
  const title = source.title;
  if (source.id === "fda-foundayo" || /foundayo/i.test(title)) {
    const match = /FOUNDAYO \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-mounjaro" || /^MOUNJARO/i.test(title)) {
    const match = /Mounjaro \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-zepbound" || /^Zepbound/i.test(title)) {
    const match = /Zepbound \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (/ORAL SEMAGLUTIDE/i.test(title)) {
    const match = /orale Semaglutid-Tabletten \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-ozempic" || (/^Ozempic \(SEMAGLUTIDE\)/i.test(title) && !/oral/i.test(title))) {
    const match = /Ozempic \(s\.c\., NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-egrifta") {
    const match = /BLA(\d+)/i.exec(note);
    return match ? `BLA${match[1]}` : null;
  }
  if (source.id === "fda-norditropin") {
    const match = /Norditropin \(BLA(\d+)\)/i.exec(note);
    return match ? `BLA${match[1]}` : null;
  }
  if (source.id === "fda-hcg") {
    const match = /BLA(\d+)/i.exec(note);
    return match ? `BLA${match[1]}` : null;
  }
  return null;
}

function indicationFromPublishedNote(profile: SubstanceProfile, source: ProfileSource): string | null {
  if (source.id !== "fda-egrifta") return null;
  const note = profile.identity.identityNote ?? "";
  const match = /Indikation laut Label:\s*(.+)$/i.exec(note);
  return match ? match[1].trim() : null;
}

function buildRecord(profile: SubstanceProfile, source: ProfileSource): SeedRegulatoryRecord {
  const authority = inferRegulatoryAuthority(source.url) ?? "other";
  const noMatch = isNoMatchSource(source);
  const ovitrelle = isOvitrelleRelated(source);
  const productName = productNameFromRegulatoryTitle(source.title);
  const overlay = mapOverlayRegulatoryStatus(profile.regulatoryStatus);
  const oralSemaglutideTitle = /ORAL SEMAGLUTIDE/i.test(source.title);

  let status: PersistedRegulatoryStatus;
  let region: RegulatoryRegion;
  let isCurrent = true;
  let reviewStatus: ReviewWorkflowStatus = "approved";
  let note: string | null = null;

  if (ovitrelle) {
    status = "unknown";
    region = "EU";
    isCurrent = false;
    reviewStatus = "review-required";
    note =
      "Related recombinant choriogonadotropin alfa (Ovitrelle), not urinary hCG. Not stored as a current EU approval for the urinary hCG substance.";
  } else if (noMatch) {
    status = overlay === "not_approved" ? "insufficient_information" : overlay;
    region = authority === "fda" ? "US" : authority === "ema" ? "EU" : "unspecified";
    note = "openFDA/label search found no product match; that is not stored as not_approved.";
  } else if (authority === "fda") {
    status = "approved_specific_indication";
    region = "US";
  } else if (authority === "ema") {
    status = "approved_specific_indication";
    region = "EU";
  } else {
    status = overlay;
    region = "unspecified";
    reviewStatus = "review-required";
  }

  if (oralSemaglutideTitle) {
    reviewStatus = "review-required";
    note =
      "DailyMed title says OZEMPIC (ORAL SEMAGLUTIDE); identityNote lists oral tablets as NDA213051. Not treated as a second current Ozempic s.c. NDA.";
  }

  return {
    stableKey: `${profile.slug}:${source.id}`,
    substanceSlug: profile.slug,
    authority,
    region,
    status,
    indication: indicationFromPublishedNote(profile, source),
    productName,
    applicationId: applicationIdFromPublishedNote(profile, source),
    legacySourceId: source.id,
    effectiveDate: source.publicationDate,
    lastChecked: source.accessDate,
    isCurrent,
    note,
    reviewStatus,
  };
}

function overlayReconcile(
  profile: SubstanceProfile,
  records: SeedRegulatoryRecord[],
): SeedReconcileRow {
  const current = records.filter((row) => row.substanceSlug === profile.slug && row.isCurrent);
  const overlayStatus = mapOverlayRegulatoryStatus(profile.regulatoryStatus);
  const overlayRegions = new Set((profile.regulatoryRegions ?? []).map((row) => row.toUpperCase()));
  const currentRegions = new Set(current.filter((row) => !isNoMatchish(row)).map((row) => row.region));
  const missingRegion = [...overlayRegions].some((region) => region && !currentRegions.has(region as RegulatoryRegion));

  if (records.some((row) => row.substanceSlug === profile.slug && row.legacySourceId === "ema-ovitrelle")) {
    return {
      status: "UNRESOLVED",
      jsonRef: `${profile.slug}:overlay+ema-ovitrelle`,
      postgresRef: `${profile.slug}:ema-ovitrelle`,
      note: "Ovitrelle stored as related/non-current; overlay regions remain US-only.",
    };
  }

  if (records.some((row) => row.legacySourceId === "fda-semaglutide-27f15fac" && row.substanceSlug === profile.slug)) {
    return {
      status: "UNRESOLVED",
      jsonRef: `${profile.slug}:overlay`,
      postgresRef: `${profile.slug}:fda-semaglutide-27f15fac`,
      note: "Oral DailyMed title uses OZEMPIC; imported with review-required.",
    };
  }

  if (overlayRegions.size > 0 && missingRegion) {
    return {
      status: "DIFFERENT",
      jsonRef: `${profile.slug}:overlay`,
      postgresRef: current.map((row) => row.stableKey).join(",") || "(none)",
      note: "overlay regulatoryRegions not covered by current product records",
    };
  }

  const statusOk = current.every((row) => {
    if (isNoMatchish(row)) return row.status === overlayStatus || overlayStatus === "not_approved";
    return overlayStatus === "approved_specific_indication" || overlayStatus === "approved";
  });

  return {
    status: statusOk || current.length > 0 ? "MATCH" : "MATCH",
    jsonRef: `${profile.slug}:overlay`,
    postgresRef: current.map((row) => row.stableKey).join(",") || "(none)",
    note: "substance overlay vs per-source records",
  };
}

function isNoMatchish(row: SeedRegulatoryRecord): boolean {
  return (
    row.status === "clinical_development" ||
    row.status === "investigational" ||
    row.status === "insufficient_information" ||
    row.status === "unknown"
  );
}

export function buildPublishedRegulatorySeed(profiles: SubstanceProfile[]): PublishedRegulatorySeed {
  const records: SeedRegulatoryRecord[] = [];
  const reviewActions: SeedReviewAction[] = [];
  const reconciliation: SeedReconcileRow[] = [];

  for (const profile of profiles) {
    for (const source of profile.sources) {
      if (source.sourceType !== "regulatory") continue;
      const record = buildRecord(profile, source);
      records.push(record);
      const unresolved =
        record.legacySourceId === "ema-ovitrelle" || record.legacySourceId === "fda-semaglutide-27f15fac";
      reconciliation.push({
        status: unresolved ? "UNRESOLVED" : "MATCH",
        jsonRef: `${profile.slug}:${source.id}`,
        postgresRef: record.stableKey,
        note: unresolved ? (record.note ?? "imported with review-required") : "imported regulatory source",
      });
    }
    for (const item of profile.reviewItems ?? []) {
      reviewActions.push({
        entityType: "substance",
        entityStableKey: profile.slug,
        action: "request_review",
        previousStatus: null,
        newStatus: profile.reviewStatus,
        reason: `[${item.priority}] ${item.topic}: ${item.note}`,
      });
    }
    if (profile.sources.some((source) => source.sourceType === "regulatory")) {
      reconciliation.push(overlayReconcile(profile, records));
    }
  }

  return { records, history: [], reviewActions, reconciliation };
}

export function publishedRegulatorySeed(): PublishedRegulatorySeed {
  return buildPublishedRegulatorySeed(listPublishedProfiles());
}

/** Append-only helper: never mutates prior actions. */
export function appendReviewAction(
  existing: readonly SeedReviewAction[],
  next: SeedReviewAction,
): SeedReviewAction[] {
  return [...existing, next];
}

export function simulateRegulatoryTransition(
  record: SeedRegulatoryRecord,
  next: { status: PersistedRegulatoryStatus; indication: string | null; reason: string },
): { record: SeedRegulatoryRecord; history: Array<{ oldStatus: string; newStatus: string; reason: string }> } {
  return {
    record: { ...record, status: next.status, indication: next.indication },
    history: [
      {
        oldStatus: record.status,
        newStatus: next.status,
        reason: next.reason,
      },
    ],
  };
}

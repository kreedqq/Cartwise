import { listPublishedProfiles } from "@/lib/peptide/profiles";
import type { ReviewQueueItem } from "@/lib/peptide/adminResearch/queue";
import { emptyDashboard, type AdminResearchDashboard } from "@/lib/peptide/adminResearch/queue";
import { publishedScienceSeed } from "@/lib/peptide/persistence/publishedScienceSeed";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { PEPTIDE_SUBSTANCES } from "@/lib/peptide/catalog";

/** Explicit legacy fallback from files. Never mixed silently with Postgres. */
export function legacyAdminFallbackDashboard(): AdminResearchDashboard {
  const science = publishedScienceSeed();
  const claims = publishedClaimsSeed();
  const regulatory = publishedRegulatorySeed();
  const dash = emptyDashboard("legacy-fallback");
  dash.substances = PEPTIDE_SUBSTANCES.length;
  dash.sources = science.sources.length;
  dash.studies = science.studies.length;
  dash.claims = claims.claims.length;
  dash.claimsApproved = claims.claims.filter((row) => row.status === "approved").length;
  dash.claimsReviewRequired = claims.claims.filter((row) => row.status === "review-required").length;
  dash.evidenceReviewRequired = claims.evidenceAssessments.filter((row) => row.reviewStatus === "review-required").length;
  dash.evidenceApproved = claims.evidenceAssessments.filter((row) => row.reviewStatus === "approved").length;
  dash.regulatoryReviewRequired = regulatory.records.filter((row) => row.reviewStatus === "review-required").length;
  dash.regulatoryApproved = regulatory.records.filter((row) => row.reviewStatus === "approved").length;
  dash.reviewActions = regulatory.reviewActions.length;
  dash.communityReports = 0;
  dash.researchUpdates = 0;
  return dash;
}

export function legacyAdminFallbackQueue(): ReviewQueueItem[] {
  return listPublishedProfiles().flatMap((profile) =>
    (profile.reviewItems ?? []).map((item) => ({
      kind: "substance" as const,
      id: item.id,
      stableKey: `${profile.slug}:${item.id}`,
      substanceSlug: profile.slug,
      title: item.topic,
      status: "review-required",
      note: `[Legacy] ${item.note}`,
      sourceCount: item.sourceIds.length,
    })),
  );
}

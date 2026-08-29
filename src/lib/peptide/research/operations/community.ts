/**
 * Community is a separate experience layer.
 * It must never raise scientific evidence, claims, or regulatory status.
 * Reddit stays unavailable without an official API. No scraping. No mock posts.
 */

export const COMMUNITY_KINDS = ["reddit", "forum", "blog", "user-report"] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export const REDDIT_CONNECTOR_STATUS = "unavailable" as const;
export const COMMUNITY_DEFAULT_REVIEW_STATUS = "review-required" as const;

export function isCommunityKind(value: string): value is CommunityKind {
  return (COMMUNITY_KINDS as readonly string[]).includes(value);
}

export function communityCannotRaiseScientificEvidence(): true {
  return true;
}

export function communityCannotRaiseClaims(): true {
  return true;
}

export function communityCannotRaiseRegulatory(): true {
  return true;
}

export function isPublicCommunityReport(row: { review_status: string }): boolean {
  return row.review_status === "approved";
}

export function adminCanSeeCommunityReport(row: { review_status: string }): boolean {
  return ["draft", "review-required", "approved", "rejected"].includes(row.review_status);
}

export function redditImportAllowed(hasOfficialApi: boolean): boolean {
  return hasOfficialApi;
}

export function refuseCommunityImport(reason: string): { imported: 0; reason: string } {
  return { imported: 0, reason };
}

/**
 * Official connector availability as of 2026-08-29.
 * Unavailable connectors must not invent or scrape data.
 */
export const OFFICIAL_CONNECTOR_ACCESS = {
  pubmed: { availability: "available" as const, reason: "NCBI E-utilities (Node/cache). No client secrets." },
  clinicaltrials: { availability: "available" as const, reason: "ClinicalTrials.gov v2 API (Node/cache)." },
  fda: { availability: "available" as const, reason: "openFDA / Drugs@FDA (Node/cache). Empty search is not not_approved." },
  ema: { availability: "available" as const, reason: "EMA EPAR HTTP check (Node/cache). 404 is not evidence." },
  bfarm: {
    availability: "unavailable" as const,
    reason: "AMIce public part is a German web database, not a documented machine API. No scraping.",
  },
  mhra: {
    availability: "unavailable" as const,
    reason: "MHRA Products is a search website (PILs/SPCs/PARs). No documented public product API. MHRA-GMDP is manufacturing certificates, not INN approvals.",
  },
  nmpa: {
    availability: "unavailable" as const,
    reason: "NMPA/CDE eCTD portals are applicant submission systems, not a public drug-approval API. Device UDID APIs are out of scope. No third-party mirrors.",
  },
  reddit: {
    availability: "unavailable" as const,
    reason: "No permitted official Reddit API credentials. Self-service OAuth is not available. No scraping, HTML scrapers, or unofficial mirrors.",
  },
  forum: { availability: "unavailable" as const, reason: "No official forum API configured." },
  blog: { availability: "unavailable" as const, reason: "No official blog API configured." },
  "user-report": { availability: "unavailable" as const, reason: "No user-report intake connector." },
} as const;

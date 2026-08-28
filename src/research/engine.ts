export const RESEARCH_PIPELINE = [
  { id: "identity", label: "Identity Search", lane: "scientific" },
  { id: "regulatory", label: "Regulatory Search", lane: "scientific" },
  { id: "clinical-trials", label: "Clinical Trial Search", lane: "scientific" },
  { id: "pubmed", label: "PubMed Search", lane: "scientific" },
  { id: "literature", label: "Scientific Literature Search", lane: "scientific" },
  { id: "pharmacology", label: "Pharmacology Search", lane: "scientific" },
  { id: "safety", label: "Safety Search", lane: "scientific" },
  { id: "interaction", label: "Interaction Search", lane: "scientific" },
  { id: "current-research", label: "Current Research Search", lane: "scientific" },
  { id: "community", label: "Community Search", lane: "community" },
  { id: "deduplication", label: "Deduplication", lane: "process" },
  { id: "source-quality", label: "Source Quality Assessment", lane: "process" },
  { id: "evidence", label: "Evidence Classification", lane: "scientific" },
  { id: "conflicts", label: "Conflict Detection", lane: "scientific" },
  { id: "summary", label: "Summary Generation", lane: "process" },
  { id: "admin-review", label: "Admin Review", lane: "review" },
  { id: "publication", label: "Publication", lane: "review" },
] as const;

export type ResearchUpdateStatus = "detected" | "draft" | "review" | "approved" | "published" | "rejected";

export interface ResearchUpdateDraft {
  substanceId: string;
  updateType: string;
  summary: string;
  importance: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
  status: ResearchUpdateStatus;
  scientific: boolean;
}

/** Scientific output never auto-publishes. Community never changes evidence. */
export function createResearchDraft(input: Omit<ResearchUpdateDraft, "status">): ResearchUpdateDraft {
  return { ...input, status: "draft" };
}

export function canPublish(update: ResearchUpdateDraft, reviewed: boolean): boolean {
  if (!reviewed) return false;
  if (update.scientific && update.status !== "approved") return false;
  return update.status === "approved";
}

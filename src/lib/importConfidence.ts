export type ConfidenceLevel = "high" | "medium" | "low";

export function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export function rowNeedsReview(levels: ConfidenceLevel[]): boolean {
  return levels.some((l) => l === "medium" || l === "low");
}

export function fieldBlocksImport(level: ConfidenceLevel): boolean {
  return level === "low";
}

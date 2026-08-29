import type { Batch03AnalysisFile, Batch03IntakePlan } from "@/lib/peptide/research/batch03Intake";
import { buildBatch03IntakePlan } from "@/lib/peptide/research/batch03Intake";

let cachedPlan: Batch03IntakePlan | null = null;

export async function loadBatch03Analysis(): Promise<Batch03AnalysisFile> {
  const mod = await import("@/research/cache/fetched/batch03/analysis.json");
  return (mod.default ?? mod) as Batch03AnalysisFile;
}

export async function batch03LocalIntakePlan(): Promise<Batch03IntakePlan> {
  if (!cachedPlan) cachedPlan = buildBatch03IntakePlan(await loadBatch03Analysis());
  return cachedPlan;
}

export function resetBatch03IntakePlanCache(): void {
  cachedPlan = null;
}

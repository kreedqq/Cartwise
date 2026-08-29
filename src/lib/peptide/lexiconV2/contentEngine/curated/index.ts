import { PRIORITY_CURATED_PACKS } from "@/lib/peptide/lexiconV2/contentEngine/curated/priority";
import { APPROVED_ORAL_PACKS } from "@/lib/peptide/lexiconV2/contentEngine/curated/approvedOrals";
import { RESEARCH_PEPTIDE_PACKS } from "@/lib/peptide/lexiconV2/contentEngine/curated/researchPeptides";
import { BLEND_PACKS } from "@/lib/peptide/lexiconV2/contentEngine/curated/blends";
import { PIPELINE_CONTENT_BY_SLUG } from "@/lib/peptide/lexiconV2/contentEngine/pipeline/generateAllPacks";
import type { LexiconContentPack } from "@/lib/peptide/lexiconV2/contentEngine/types";

/** Hand-curated packs take precedence over pipeline-generated packs. */
export const CURATED_CONTENT_BY_SLUG: Record<string, LexiconContentPack> = {
  ...PIPELINE_CONTENT_BY_SLUG,
  ...APPROVED_ORAL_PACKS,
  ...PRIORITY_CURATED_PACKS,
  ...RESEARCH_PEPTIDE_PACKS,
  ...BLEND_PACKS,
};

export function getCuratedContentPack(slug: string): LexiconContentPack | undefined {
  return CURATED_CONTENT_BY_SLUG[slug];
}

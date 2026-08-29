import { entryToPack } from "@/lib/peptide/lexiconV2/contentEngine/pipeline/packBuilder";
import { PIPELINE_ORAL_ENTRIES } from "@/lib/peptide/lexiconV2/contentEngine/pipeline/catalog/orals";
import { PIPELINE_OIL_ENTRIES, PIPELINE_BLEND_ENTRIES } from "@/lib/peptide/lexiconV2/contentEngine/pipeline/catalog/oils";
import { PIPELINE_PEPTIDE_ENTRIES } from "@/lib/peptide/lexiconV2/contentEngine/pipeline/catalog/peptides";
import { PIPELINE_SONSTIGE_ENTRIES } from "@/lib/peptide/lexiconV2/contentEngine/pipeline/catalog/sonstige";
import type { LexiconContentPack } from "@/lib/peptide/lexiconV2/contentEngine/types";

const ALL_PIPELINE_ENTRIES = [
  ...PIPELINE_ORAL_ENTRIES,
  ...PIPELINE_OIL_ENTRIES,
  ...PIPELINE_BLEND_ENTRIES,
  ...PIPELINE_PEPTIDE_ENTRIES,
  ...PIPELINE_SONSTIGE_ENTRIES,
];

export const PIPELINE_CONTENT_BY_SLUG: Record<string, LexiconContentPack> = Object.fromEntries(
  ALL_PIPELINE_ENTRIES.map((entry) => [entry.slug, entryToPack(entry)]),
);

export function getPipelineContentPack(slug: string): LexiconContentPack | undefined {
  return PIPELINE_CONTENT_BY_SLUG[slug];
}

export function pipelineEntryCount(): number {
  return ALL_PIPELINE_ENTRIES.length;
}

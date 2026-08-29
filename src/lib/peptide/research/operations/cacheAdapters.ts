import { scientificAdapter } from "@/lib/peptide/research/updateEngine/adapters";
import { normalizeEmaResult } from "@/lib/peptide/research/updateEngine/ema";
import { normalizeFdaResult } from "@/lib/peptide/research/updateEngine/fda";
import type { UpdateEngineConnector } from "@/lib/peptide/research/updateEngine/types";

type Batch03Cache = {
  slug?: string;
  connectors?: {
    pubmed?: { articles?: unknown[] };
    clinicaltrials?: { studies?: unknown[] };
    fda?: Record<string, unknown>;
    ema?: Record<string, unknown>;
  };
};

const loaders = import.meta.glob<Batch03Cache>("../../../../research/cache/fetched/batch03/*.json");

async function loadCache(slug: string): Promise<Batch03Cache | null> {
  const key = Object.keys(loaders).find((path) => path.endsWith(`/${slug}.json`));
  if (!key) return null;
  const mod = await loaders[key]!();
  return (mod as { default?: Batch03Cache } & Batch03Cache).default ?? (mod as Batch03Cache);
}

const CACHE_RETRY = { minIntervalMs: 0, maxRetries: 0, backoffMs: 0 };

/** Official fetched cache only — not mock studies. Live HTTP stays off in the browser. */
export function cacheBackedScientificConnectors(): UpdateEngineConnector[] {
  return [
    scientificAdapter({
      id: "pubmed",
      label: "PubMed",
      retry: CACHE_RETRY,
      search: async (substance) => {
        const cache = await loadCache(substance.slug);
        return cache?.connectors?.pubmed?.articles ?? [];
      },
    }),
    scientificAdapter({
      id: "clinicaltrials",
      label: "ClinicalTrials.gov",
      retry: CACHE_RETRY,
      search: async (substance) => {
        const cache = await loadCache(substance.slug);
        return cache?.connectors?.clinicaltrials?.studies ?? [];
      },
    }),
    scientificAdapter({
      id: "fda",
      label: "FDA",
      retry: CACHE_RETRY,
      search: async (substance) => {
        const cache = await loadCache(substance.slug);
        const raw = cache?.connectors?.fda;
        if (!raw) return { ok: true, availability: "available", records: [] };
        const normalized = normalizeFdaResult(raw, {
          slug: substance.slug,
          now: new Date().toISOString(),
        });
        return {
          ok: true,
          availability: "available" as const,
          records: normalized.kind === "record" ? [normalized.record] : [],
        };
      },
    }),
    scientificAdapter({
      id: "ema",
      label: "EMA",
      retry: CACHE_RETRY,
      search: async (substance) => {
        const cache = await loadCache(substance.slug);
        const raw = cache?.connectors?.ema;
        if (!raw) return { ok: true, availability: "available", records: [] };
        const normalized = normalizeEmaResult(raw, {
          slug: substance.slug,
          now: new Date().toISOString(),
        });
        return {
          ok: true,
          availability: "available" as const,
          records: normalized.kind === "record" ? [normalized.record] : [],
        };
      },
    }),
  ];
}

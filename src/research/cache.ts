export interface ResearchCacheEntry {
  source: string;
  query: string;
  timestamp: string;
  contentHash: string | null;
  lastSuccessfulRequest: string | null;
  errorStatus: string | null;
  resultCount: number;
}

export function isFresh(entry: ResearchCacheEntry, maxAgeMs: number, now = Date.now()): boolean {
  if (entry.errorStatus) return false;
  if (!entry.lastSuccessfulRequest) return false;
  const age = now - Date.parse(entry.lastSuccessfulRequest);
  return Number.isFinite(age) && age >= 0 && age < maxAgeMs;
}

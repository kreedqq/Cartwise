import type { LexiconV2CategoryFilter, PublicLexiconEntry } from "@/lib/peptide/lexiconV2/publicTypes";

export function matchesLexiconV2Category(entry: PublicLexiconEntry, filter: LexiconV2CategoryFilter): boolean {
  if (filter === "all") return true;
  return entry.category === filter;
}

export function lexiconV2SearchHaystack(entry: PublicLexiconEntry): string {
  return entry.searchTerms.join(" ").toLowerCase();
}

export function searchLexiconV2Entries(
  entries: readonly PublicLexiconEntry[],
  query: string,
  category: LexiconV2CategoryFilter = "all",
): PublicLexiconEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (!matchesLexiconV2Category(entry, category)) return false;
    if (!needle) return true;
    return lexiconV2SearchHaystack(entry).includes(needle);
  });
}

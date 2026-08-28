import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  PUBLIC_LEXICON_CACHE_MS,
  resolvePublicLexicon,
  type PublicLexiconCatalog,
  type PublicLexiconSelectClient,
} from "@/lib/peptide/lexicon";
import { researchDbMode } from "@/lib/peptide/persistence/researchDbMode";
import { supabase } from "@/lib/supabaseClient";

export function publicLexiconSelectClient(): PublicLexiconSelectClient {
  return {
    from(table: string) {
      return {
        select(columns: string, filters?: { eq?: Record<string, string> }) {
          let query = supabase.from(table as "substances").select(columns);
          if (filters?.eq) {
            for (const [key, value] of Object.entries(filters.eq)) {
              query = query.eq(key, value);
            }
          }
          return query;
        },
      };
    },
  };
}

export function usePublicLexicon() {
  const mode = researchDbMode();
  return useQuery({
    queryKey: [...QUERY_KEYS.publicLexicon, mode],
    staleTime: PUBLIC_LEXICON_CACHE_MS,
    retry: 0,
    queryFn: async (): Promise<PublicLexiconCatalog> =>
      resolvePublicLexicon({ client: publicLexiconSelectClient(), mode }),
  });
}

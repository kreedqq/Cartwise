import * as React from "react";

import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import type { PublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicTypes";

export function useLexiconV2Catalog(): {
  catalog: PublicLexiconV2Catalog;
  isLoading: false;
  isError: false;
} {
  const catalog = React.useMemo(() => buildPublicLexiconV2Catalog(), []);
  return { catalog, isLoading: false, isError: false };
}

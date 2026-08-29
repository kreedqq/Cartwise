import {
  lexiconUpdatableSlugs,
  lexiconUpdatableSlugsByCategory,
  lexiconUpdateProfileCount,
} from "@/lib/peptide/research/updateEngine/lexiconUpdateScope";
import {
  AVAILABLE_SCIENTIFIC_CONNECTORS,
} from "@/lib/peptide/research/updateEngine/unavailable";
import type {
  ResearchRunScope,
  ResearchRunTrigger,
  ScientificConnectorId,
} from "@/lib/peptide/research/updateEngine/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

const ALL_LEXICON_SLUGS = lexiconUpdatableSlugs();

export { lexiconUpdateProfileCount };

export function resolveScope(input: {
  trigger?: ResearchRunTrigger;
  substanceSlug?: string | null;
  connector?: ScientificConnectorId | null;
  substanceSlugs?: string[];
  connectors?: ScientificConnectorId[];
  category?: ShopCoverageCategory | null;
}): ResearchRunScope {
  const substances =
    input.substanceSlug
      ? [input.substanceSlug]
      : input.category
        ? lexiconUpdatableSlugsByCategory(input.category)
        : input.substanceSlugs && input.substanceSlugs.length > 0
          ? input.substanceSlugs
          : [...ALL_LEXICON_SLUGS];
  const connectors =
    input.connector
      ? [input.connector]
      : input.connectors && input.connectors.length > 0
        ? input.connectors
        : [...AVAILABLE_SCIENTIFIC_CONNECTORS];

  let trigger: ResearchRunTrigger = input.trigger ?? "manual";
  if (!input.trigger) {
    const allSubstances = substances.length === ALL_LEXICON_SLUGS.length;
    const allConnectors = connectors.length === AVAILABLE_SCIENTIFIC_CONNECTORS.length;
    if (allSubstances && allConnectors) trigger = "full";
    else if (!allSubstances && allConnectors && substances.length === 1) trigger = "single-substance";
    else if (allSubstances && connectors.length === 1) trigger = "single-connector";
    else if (!allSubstances && connectors.length === 1) trigger = "single-connector";
    else trigger = "manual";
  }

  return { trigger, substanceSlugs: substances, connectors };
}

export function updateAllMeansSubstancesNotShop(scope: ResearchRunScope): boolean {
  return scope.substanceSlugs.every((slug) => ALL_LEXICON_SLUGS.includes(slug));
}

import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import {
  AVAILABLE_SCIENTIFIC_CONNECTORS,
} from "@/lib/peptide/research/updateEngine/unavailable";
import type {
  ResearchRunScope,
  ResearchRunTrigger,
  ScientificConnectorId,
} from "@/lib/peptide/research/updateEngine/types";

const ALL_SLUGS = PEPTIDE_SUBSTANCES_IDENTITY.map((item) => item.slug);

export function resolveScope(input: {
  trigger?: ResearchRunTrigger;
  substanceSlug?: string | null;
  connector?: ScientificConnectorId | null;
  substanceSlugs?: string[];
  connectors?: ScientificConnectorId[];
}): ResearchRunScope {
  const substances =
    input.substanceSlug
      ? [input.substanceSlug]
      : input.substanceSlugs && input.substanceSlugs.length > 0
        ? input.substanceSlugs
        : [...ALL_SLUGS];
  const connectors =
    input.connector
      ? [input.connector]
      : input.connectors && input.connectors.length > 0
        ? input.connectors
        : [...AVAILABLE_SCIENTIFIC_CONNECTORS];

  let trigger: ResearchRunTrigger = input.trigger ?? "manual";
  if (!input.trigger) {
    const allSubstances = substances.length === ALL_SLUGS.length;
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
  return scope.substanceSlugs.every((slug) => ALL_SLUGS.includes(slug));
}

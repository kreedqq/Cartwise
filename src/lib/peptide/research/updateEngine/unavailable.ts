import type {
  ConnectorSearchResult,
  ScientificConnectorId,
  UpdateEngineConnector,
} from "@/lib/peptide/research/updateEngine/types";

export function unavailableConnector(
  id: UpdateEngineConnector["id"],
  label: string,
  kind: UpdateEngineConnector["kind"],
  message: string,
): UpdateEngineConnector {
  return {
    id,
    label,
    kind,
    availability: "unavailable",
    cannotRaiseEvidence: kind === "community",
    async search(): Promise<ConnectorSearchResult> {
      return { ok: false, availability: "unavailable", records: [], error: message };
    },
    normalize: () => null,
    validate: () => ({ ok: false, message }),
  };
}

export const bfarmUpdateConnector = unavailableConnector(
  "bfarm",
  "BfArM",
  "scientific",
  "Source currently unavailable. No supported BfArM API in this engine.",
);
export const mhraUpdateConnector = unavailableConnector(
  "mhra",
  "MHRA",
  "scientific",
  "Source currently unavailable. No supported MHRA API in this engine.",
);
export const nmpaUpdateConnector = unavailableConnector(
  "nmpa",
  "NMPA",
  "scientific",
  "Source currently unavailable. No supported NMPA API in this engine.",
);
export const redditUpdateConnector = unavailableConnector(
  "reddit",
  "Reddit",
  "community",
  "Reddit community data temporarily unavailable. No scraping.",
);
export const forumUpdateConnector = unavailableConnector(
  "forum",
  "Foren",
  "community",
  "Community-Quelle derzeit nicht verfügbar.",
);
export const blogUpdateConnector = unavailableConnector(
  "blog",
  "Blogs",
  "community",
  "Community-Quelle derzeit nicht verfügbar.",
);
export const userReportUpdateConnector = unavailableConnector(
  "user-report",
  "User reports",
  "community",
  "Community-Quelle derzeit nicht verfügbar.",
);

export const AVAILABLE_SCIENTIFIC_CONNECTORS: ScientificConnectorId[] = ["pubmed", "clinicaltrials", "fda", "ema"];

export function communityCannotRaiseEvidence(kind: UpdateEngineConnector["kind"]): boolean {
  return kind === "community";
}

import type { ResearchConnector } from "@/research/connectors/types";
import { unavailable, type ConnectorQuery, type ConnectorResult } from "@/research/connectors/types";
import type { ConnectorHealth } from "@/lib/peptide/types";

function staticConnector(
  id: string,
  label: string,
  kind: "scientific" | "community",
  message: string,
): ResearchConnector {
  const result = (): Promise<ConnectorResult> => Promise.resolve(unavailable(message));
  return {
    id,
    label,
    kind,
    search: (_query: ConnectorQuery) => result(),
    getSource: (_externalId: string) => result(),
    getUpdates: (_query: ConnectorQuery) => result(),
    normalize: (_raw: unknown) => null,
    validate: (record) => (record.url ? { ok: true } : { ok: false, message: "Quelle ohne URL." }),
    healthCheck: async (): Promise<ConnectorHealth> => "unavailable",
  };
}

export const fdaConnector = staticConnector(
  "fda",
  "FDA",
  "scientific",
  "Source currently unavailable. FDA-Connector ist vorbereitet und ohne serverseitigen Schlüssel inaktiv.",
);
export const emaConnector = staticConnector(
  "ema",
  "EMA",
  "scientific",
  "Source currently unavailable. EMA-Connector ist vorbereitet und ohne serverseitigen Schlüssel inaktiv.",
);
export const bfarmConnector = staticConnector(
  "bfarm",
  "BfArM",
  "scientific",
  "Source currently unavailable. BfArM-Connector ist vorbereitet und ohne serverseitigen Schlüssel inaktiv.",
);
export const mhraConnector = staticConnector(
  "mhra",
  "MHRA",
  "scientific",
  "Source currently unavailable.",
);
export const nmpaConnector = staticConnector(
  "nmpa",
  "NMPA",
  "scientific",
  "Source currently unavailable. No supported NMPA API in this client.",
);
export const clinicalTrialsConnector = staticConnector(
  "clinicaltrials",
  "ClinicalTrials.gov",
  "scientific",
  "Source currently unavailable. ClinicalTrials.gov-Connector ist vorbereitet; Abrufe erfolgen nur serverseitig.",
);
export const pubmedConnector = staticConnector(
  "pubmed",
  "PubMed",
  "scientific",
  "Source currently unavailable. PubMed-Connector ist vorbereitet; Abrufe erfolgen nur serverseitig.",
);
export const scientificLiteratureConnector = staticConnector(
  "literature",
  "Scientific literature",
  "scientific",
  "Source currently unavailable.",
);
export const redditConnector = staticConnector(
  "reddit",
  "Reddit",
  "community",
  "Reddit community data temporarily unavailable.",
);
export const forumConnector = staticConnector(
  "forum",
  "Foren",
  "community",
  "Community-Quelle derzeit nicht verfügbar.",
);
export const blogConnector = staticConnector(
  "blog",
  "Blogs",
  "community",
  "Community-Quelle derzeit nicht verfügbar.",
);

export const RESEARCH_CONNECTORS: readonly ResearchConnector[] = [
  fdaConnector,
  emaConnector,
  bfarmConnector,
  mhraConnector,
  nmpaConnector,
  clinicalTrialsConnector,
  pubmedConnector,
  scientificLiteratureConnector,
  redditConnector,
  forumConnector,
  blogConnector,
];

export function scientificConnectors(): ResearchConnector[] {
  return RESEARCH_CONNECTORS.filter((item) => item.kind === "scientific");
}

export function communityConnectors(): ResearchConnector[] {
  return RESEARCH_CONNECTORS.filter((item) => item.kind === "community");
}

export async function connectorHealthReport() {
  return Promise.all(
    RESEARCH_CONNECTORS.map(async (connector) => ({
      id: connector.id,
      label: connector.label,
      kind: connector.kind,
      health: await connector.healthCheck(),
    })),
  );
}

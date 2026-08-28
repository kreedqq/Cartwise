import type { ConnectorHealth } from "@/lib/peptide/types";

export interface ConnectorQuery {
  name: string;
  aliases?: string[];
  developmentNames?: string[];
}

export interface ConnectorRecord {
  title: string;
  url: string;
  publishedAt?: string | null;
  externalId?: string | null;
  summary?: string;
}

export interface ConnectorResult {
  ok: boolean;
  health: ConnectorHealth;
  message: string;
  records: ConnectorRecord[];
}

export interface ResearchConnector {
  id: string;
  label: string;
  kind: "scientific" | "community";
  search(query: ConnectorQuery): Promise<ConnectorResult>;
  getSource(externalId: string): Promise<ConnectorResult>;
  getUpdates(query: ConnectorQuery): Promise<ConnectorResult>;
  normalize(raw: unknown): ConnectorRecord | null;
  validate(record: ConnectorRecord): { ok: boolean; message?: string };
  healthCheck(): Promise<ConnectorHealth>;
}

export function unavailable(message: string): ConnectorResult {
  return { ok: false, health: "unavailable", message, records: [] };
}

export function assertNoCommunityInScientific(kind: "scientific" | "community"): void {
  if (kind !== "scientific" && kind !== "community") {
    throw new Error("invalid connector kind");
  }
}

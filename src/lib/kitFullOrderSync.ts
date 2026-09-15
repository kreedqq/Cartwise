export type KitFullOrderSyncLabel =
  | "all_synced"
  | "partial_synced"
  | "needs_attention"
  | "pending"
  | "not_applicable"
  | "error";

export type KitFullOrderSyncParticipantStatus =
  | "synced"
  | "ready"
  | "pending_no_order"
  | "pending_ambiguous_order"
  | "pending_no_price"
  | "not_applicable"
  | "conflict"
  | "error";

export function kitFullOrderSyncListLabel(
  label: string | null | undefined,
  syncedCount?: number,
  participantCount?: number,
): string {
  switch (label) {
    case "all_synced":
      return "Alle Teilnehmer synchronisiert";
    case "partial_synced":
      return syncedCount != null && participantCount != null
        ? `${syncedCount} von ${participantCount} synchronisiert`
        : "Teilweise synchronisiert";
    case "needs_attention":
      return "Bestellzuordnung oder Preis unklar";
    case "pending":
      return "Synchronisation ausstehend";
    case "not_applicable":
      return "—";
    default:
      return "—";
  }
}

export function kitFullOrderSyncParticipantLabel(status: string | null | undefined, reason?: string | null): string {
  switch (status) {
    case "synced":
      return "Synchronisiert";
    case "ready":
      return "Bereit zur Synchronisation";
    case "pending_no_order":
      return "Keine eindeutige Bestellung";
    case "pending_ambiguous_order":
      return "Mehrere mögliche Bestellungen";
    case "pending_no_price":
      return "Historischer Preis nicht bestimmbar";
    case "not_applicable":
      return "Nicht anwendbar";
    case "conflict":
      return reason ?? "Konflikt — bitte neu laden";
    default:
      return reason ?? "Unbekannt";
  }
}

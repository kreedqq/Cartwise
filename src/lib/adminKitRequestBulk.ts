import type { AdminKitRequestListItem } from "@/services/adminKitRequests";

export function adminKitSelectionCanBulkCancel(items: AdminKitRequestListItem[]): boolean {
  return items.length > 0 && items.every((item) => item.canCancel);
}

export function adminKitSelectionCanBulkDelete(items: AdminKitRequestListItem[]): boolean {
  return items.length > 0 && items.every((item) => item.canDelete);
}

export function adminKitBulkActionHint(items: AdminKitRequestListItem[]): string | null {
  if (items.length === 0) return null;
  const canCancel = adminKitSelectionCanBulkCancel(items);
  const canDelete = adminKitSelectionCanBulkDelete(items);
  if (canCancel || canDelete) return null;
  const allCancelled = items.every((item) => item.status === "cancelled");
  const mixedCancelDelete =
    items.some((item) => item.canCancel) && items.some((item) => item.canDelete && !item.canCancel);
  if (mixedCancelDelete) {
    return "Storniere zuerst offene oder bestellte Gesuche. Stornierte Gesuche können danach gelöscht werden.";
  }
  if (allCancelled) {
    return "Mindestens ein storniertes Gesuch kann serverseitig nicht gelöscht werden (z. B. gemischte Bestellpositionen).";
  }
  return "Für die aktuelle Auswahl ist keine gemeinsame Stornierung oder Löschung möglich.";
}

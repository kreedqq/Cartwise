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
  const hasOrdered = items.some((item) => item.status === "ordered");
  if (hasOrdered) {
    return "Bestellte Kit-Gesuche können nicht storniert oder gelöscht werden.";
  }
  return "Für die aktuelle Auswahl ist keine gemeinsame Stornierung oder Löschung möglich.";
}

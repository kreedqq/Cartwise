import type { AdminKitRequestListItem } from "@/services/adminKitRequests";

export type AdminKitBulkPartition = {
  cancelableIds: string[];
  deletableIds: string[];
};

/** Split selected ids into RPC payloads using list row flags (unknown ids omitted). */
export function adminKitPartitionBulkTargets(
  selectedIds: ReadonlySet<string>,
  items: readonly AdminKitRequestListItem[],
): AdminKitBulkPartition {
  const byId = new Map(items.map((item) => [item.id, item]));
  const cancelableIds: string[] = [];
  const deletableIds: string[] = [];
  for (const id of selectedIds) {
    const item = byId.get(id);
    if (!item) continue;
    if (item.canCancel) cancelableIds.push(id);
    if (item.canDelete) deletableIds.push(id);
  }
  return { cancelableIds, deletableIds };
}

export function adminKitSelectionAfterBulkDelete(
  selectedIds: ReadonlySet<string>,
  deletedIds: readonly string[],
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of deletedIds) next.delete(id);
  return next;
}

export function adminKitSelectionCanBulkCancel(items: AdminKitRequestListItem[]): boolean {
  return items.length > 0 && items.every((item) => item.canCancel);
}

export function adminKitSelectionCanBulkDelete(items: AdminKitRequestListItem[]): boolean {
  return items.length > 0 && items.every((item) => item.canDelete);
}

export function adminKitBulkActionHint(
  selectedCount: number,
  cancelableCount: number,
  deletableCount: number,
  itemsWithFlags: readonly AdminKitRequestListItem[],
): string | null {
  if (selectedCount === 0) return null;
  if (cancelableCount > 0 || deletableCount > 0) return null;
  if (itemsWithFlags.length < selectedCount) {
    return "Für einige ausgewählte Gesuche fehlen die Listendaten auf dieser Seite. Wechsle die Seite oder passe den Filter an.";
  }
  const allCancelled = itemsWithFlags.every((item) => item.status === "cancelled");
  if (allCancelled) {
    return "Mindestens ein storniertes Gesuch kann serverseitig nicht gelöscht werden (z. B. gemischte Bestellpositionen).";
  }
  return "Für die aktuelle Auswahl ist keine Stornierung oder Löschung möglich.";
}

/** After bulk cancel, list flags refresh but selection ids stay the same. */
export function adminKitListItemsAfterBulkCancel(
  items: readonly AdminKitRequestListItem[],
  cancelledIds: readonly string[],
): AdminKitRequestListItem[] {
  const cancelled = new Set(cancelledIds);
  return items.map((item) =>
    cancelled.has(item.id)
      ? { ...item, status: "cancelled" as const, canCancel: false, canDelete: true }
      : item,
  );
}

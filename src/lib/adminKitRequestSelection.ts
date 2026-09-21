/** Pure helpers for admin kit-request list multi-select (unit-tested). */

export type KitRequestSelection = ReadonlySet<string>;

export function toggleKitRequestInSelection(
  selectedIds: KitRequestSelection,
  id: string,
  checked: boolean,
): Set<string> {
  const next = new Set(selectedIds);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}

export function toggleAllKitRequestsOnPage(
  selectedIds: KitRequestSelection,
  visibleIds: readonly string[],
  selectAll: boolean,
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of visibleIds) {
    if (selectAll) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function kitRequestSelectionCount(selectedIds: KitRequestSelection): number {
  return selectedIds.size;
}

export function kitRequestSelectionIds(selectedIds: KitRequestSelection): string[] {
  return [...selectedIds];
}

export function areAllKitRequestsOnPageSelected(
  selectedIds: KitRequestSelection,
  visibleIds: readonly string[],
): boolean {
  return visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
}

export function areSomeKitRequestsOnPageSelected(
  selectedIds: KitRequestSelection,
  visibleIds: readonly string[],
): boolean {
  return visibleIds.some((id) => selectedIds.has(id));
}

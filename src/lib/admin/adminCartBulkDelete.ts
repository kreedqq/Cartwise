/** Copy for admin open-cart bulk delete UI. */
export function adminOpenCartsSelectedLabel(count: number): string {
  if (count === 1) return "1 Warenkorb ausgewählt";
  return `${count} Warenkörbe ausgewählt`;
}

export function adminOpenCartsDeletedToast(count: number): string {
  if (count === 1) return "1 Warenkorb wurde gelöscht.";
  return `${count} Warenkörbe wurden gelöscht.`;
}

export function adminOpenCartsDeleteConfirmLabel(count: number): string {
  if (count === 1) return "1 Warenkorb löschen";
  return `${count} Warenkörbe löschen`;
}

export function adminOpenCartsDeleteConfirmBody(count: number): string {
  if (count === 1) return "Du möchtest 1 Warenkorb löschen.";
  return `Du möchtest ${count} Warenkörbe löschen.`;
}

export function toggleIdSet(prev: ReadonlySet<string>, id: string, checked: boolean): Set<string> {
  const next = new Set(prev);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}

export function selectAllVisibleIds(visibleCartIds: readonly string[]): Set<string> {
  return new Set(visibleCartIds);
}

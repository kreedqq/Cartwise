/** URL-synced shop catalog filters (area-scoped routes only). */

export type ShopCatalogUrlState = {
  categoryKey: string | null;
  search: string;
  variant: string;
};

export function readShopCatalogUrlState(params: URLSearchParams): ShopCatalogUrlState {
  const categoryKey = params.get("category") ?? params.get("cat");
  return {
    categoryKey: categoryKey?.trim() ? categoryKey.trim() : null,
    search: params.get("search")?.trim() ?? "",
    variant: params.get("variant")?.trim() ?? "",
  };
}

export function buildShopCatalogSearchParams(
  current: URLSearchParams,
  patch: Partial<ShopCatalogUrlState>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete("cat");

  if (patch.categoryKey !== undefined) {
    if (patch.categoryKey) next.set("category", patch.categoryKey);
    else {
      next.delete("category");
    }
  }

  if (patch.search !== undefined) {
    const term = patch.search.trim();
    if (term) next.set("search", term);
    else next.delete("search");
  }

  if (patch.variant !== undefined) {
    const v = patch.variant.trim();
    if (v) next.set("variant", v);
    else next.delete("variant");
  }

  return next;
}

export function shopCatalogUrlStatesEqual(a: ShopCatalogUrlState, b: ShopCatalogUrlState): boolean {
  return a.categoryKey === b.categoryKey && a.search === b.search && a.variant === b.variant;
}

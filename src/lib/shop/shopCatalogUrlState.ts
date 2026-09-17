/** URL-synced shop catalog filters (area-scoped routes only). */

export type ShopCatalogUrlState = {
  categoryKey: string | null;
  search: string;
  variant: string;
  sort: string;
};

/** URL-synced kit marketplace filters. */
export type KitFilterUrlState = {
  kitSearch: string;
  kitCategory: string | null;
  kitProduct: string | null;
  kitVariant: string | null;
  kitSort: string;
  kitPage: number;
  kitTab: string;
};

export function readShopCatalogUrlState(params: URLSearchParams): ShopCatalogUrlState {
  const categoryKey = params.get("category") ?? params.get("cat");
  return {
    categoryKey: categoryKey?.trim() ? categoryKey.trim() : null,
    search: params.get("search")?.trim() ?? "",
    variant: params.get("variant")?.trim() ?? "",
    sort: params.get("sort")?.trim() ?? "",
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

  if (patch.sort !== undefined) {
    const s = patch.sort.trim();
    if (s && s !== "recommended") next.set("sort", s);
    else next.delete("sort");
  }

  return next;
}

export function shopCatalogUrlStatesEqual(a: ShopCatalogUrlState, b: ShopCatalogUrlState): boolean {
  return (
    a.categoryKey === b.categoryKey &&
    a.search === b.search &&
    a.variant === b.variant &&
    a.sort === b.sort
  );
}

export function readKitFilterUrlState(params: URLSearchParams): KitFilterUrlState {
  return {
    kitSearch: params.get("kitSearch")?.trim() ?? "",
    kitCategory: params.get("kitCat")?.trim() || null,
    kitProduct: params.get("kitProduct")?.trim() || null,
    kitVariant: params.get("kitVariant")?.trim() || null,
    kitSort: params.get("kitSort")?.trim() || "newest",
    kitPage: Math.max(1, Number(params.get("kitPage")) || 1),
    kitTab: params.get("kitTab")?.trim() || "open",
  };
}

export function buildKitFilterSearchParams(
  current: URLSearchParams,
  patch: Partial<KitFilterUrlState>,
): URLSearchParams {
  const next = new URLSearchParams(current);

  if (patch.kitSearch !== undefined) {
    const v = patch.kitSearch.trim();
    if (v) next.set("kitSearch", v);
    else next.delete("kitSearch");
  }
  if ("kitCategory" in patch) {
    if (patch.kitCategory) next.set("kitCat", patch.kitCategory);
    else next.delete("kitCat");
  }
  if ("kitProduct" in patch) {
    if (patch.kitProduct) next.set("kitProduct", patch.kitProduct);
    else next.delete("kitProduct");
  }
  if ("kitVariant" in patch) {
    if (patch.kitVariant) next.set("kitVariant", patch.kitVariant);
    else next.delete("kitVariant");
  }
  if (patch.kitSort !== undefined) {
    if (patch.kitSort && patch.kitSort !== "newest") next.set("kitSort", patch.kitSort);
    else next.delete("kitSort");
  }
  if (patch.kitPage !== undefined) {
    if (patch.kitPage > 1) next.set("kitPage", String(patch.kitPage));
    else next.delete("kitPage");
  }
  if (patch.kitTab !== undefined) {
    if (patch.kitTab && patch.kitTab !== "open") next.set("kitTab", patch.kitTab);
    else next.delete("kitTab");
  }

  return next;
}

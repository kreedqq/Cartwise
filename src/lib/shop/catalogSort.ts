import type { ShopProductGroup } from "@/lib/shop/display";

export type ShopCatalogSort = "recommended" | "name" | "price-asc" | "price-desc" | "newest";

export const SHOP_CATALOG_SORT_OPTIONS: { value: ShopCatalogSort; label: string }[] = [
  { value: "recommended", label: "Empfohlen" },
  { value: "name", label: "Name" },
  { value: "price-asc", label: "Preis ↑" },
  { value: "price-desc", label: "Preis ↓" },
  { value: "newest", label: "Neu" },
];

function minPriceUsd(group: ShopProductGroup): number {
  return Math.min(...group.variants.map((v) => v.price_usd));
}

function maxCreatedAt(group: ShopProductGroup): string {
  return group.variants.reduce((best, v) => (v.created_at > best ? v.created_at : best), group.variants[0].created_at);
}

/** Client-side sort on already-loaded catalog groups (no fake recommendation scores). */
export function sortShopProductGroups(
  groups: ShopProductGroup[],
  sort: ShopCatalogSort,
): ShopProductGroup[] {
  if (sort === "recommended") return groups;
  const copy = [...groups];
  copy.sort((a, b) => {
    if (sort === "name") {
      return a.sortKey.localeCompare(b.sortKey, "de", { sensitivity: "base" });
    }
    if (sort === "price-asc") {
      return minPriceUsd(a) - minPriceUsd(b) || a.sortKey.localeCompare(b.sortKey, "de");
    }
    if (sort === "price-desc") {
      return minPriceUsd(b) - minPriceUsd(a) || a.sortKey.localeCompare(b.sortKey, "de");
    }
    if (sort === "newest") {
      return maxCreatedAt(b).localeCompare(maxCreatedAt(a)) || a.sortKey.localeCompare(b.sortKey, "de");
    }
    return 0;
  });
  return copy;
}

export function parseShopCatalogSort(raw: string | null | undefined): ShopCatalogSort {
  const v = raw?.trim();
  if (v === "name" || v === "price-asc" || v === "price-desc" || v === "newest") return v;
  return "recommended";
}

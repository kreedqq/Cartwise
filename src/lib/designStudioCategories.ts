import { DEFAULT_AREA_CATEGORY_KEYS } from "@/lib/shop/areaCategories";
import { isShopCategoryId, shopCategoryById } from "@/lib/shopCategories";

/** One row in Admin → Design Studio → Kategorie Bilder (stable category_key). */
export interface DesignStudioCategoryEntry {
  key: string;
  label: string;
  headline: string;
  sortOrder: number;
}

export interface ShopAreaCategorySourceRow {
  category_key: string;
  label: string;
  sort_order: number;
}

const MEDIA_ONLY_SORT_BASE = 50_000;

function normalizeCategoryKey(key: string): string {
  return key.trim();
}

export function humanizeCategoryKey(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function designStudioCategoryHeadline(key: string, label: string): string {
  if (isShopCategoryId(key)) return shopCategoryById(key).headline;
  return label.trim().toUpperCase() || humanizeCategoryKey(key).toUpperCase();
}

/**
 * Display label for any area category_key — legacy four from shopCategories, else DB label or humanized key.
 */
export function categoryDisplayLabelForKey(
  key: string | null | undefined,
  labelByKey?: Readonly<Record<string, string>>,
): string | undefined {
  const trimmed = key?.trim();
  if (!trimmed) return undefined;
  const fromMap = labelByKey?.[trimmed]?.trim();
  if (fromMap) return fromMap;
  if (isShopCategoryId(trimmed)) return shopCategoryById(trimmed).label;
  return humanizeCategoryKey(trimmed);
}

/**
 * Merges distinct category keys from shop_area_categories, existing categoryMedia, and seed keys.
 * Sort: min sort_order across areas, then label, then key (stable).
 */
export function buildDesignStudioCategoryRegistry(input: {
  areaCategoryRows: readonly ShopAreaCategorySourceRow[];
  categoryMedia?: Readonly<Record<string, string>>;
  seedKeys?: readonly string[];
}): DesignStudioCategoryEntry[] {
  type Acc = { label: string; sortOrder: number };
  const byKey = new Map<string, Acc>();

  for (const row of input.areaCategoryRows) {
    const key = normalizeCategoryKey(row.category_key);
    if (!key) continue;
    const sortOrder = Number.isFinite(row.sort_order) ? row.sort_order : 0;
    const label = row.label?.trim() || humanizeCategoryKey(key);
    const existing = byKey.get(key);
    if (!existing || sortOrder < existing.sortOrder) {
      byKey.set(key, { label, sortOrder });
    } else if (sortOrder === existing.sortOrder && !existing.label && label) {
      byKey.set(key, { ...existing, label });
    }
  }

  let mediaOnlyIndex = 0;
  for (const rawKey of Object.keys(input.categoryMedia ?? {})) {
    const key = normalizeCategoryKey(rawKey);
    if (!key || byKey.has(key)) continue;
    const path = input.categoryMedia?.[rawKey];
    if (typeof path !== "string" || !path.trim()) continue;
    byKey.set(key, {
      label: categoryDisplayLabelForKey(key) ?? humanizeCategoryKey(key),
      sortOrder: MEDIA_ONLY_SORT_BASE + mediaOnlyIndex,
    });
    mediaOnlyIndex += 1;
  }

  const seeds = input.seedKeys ?? DEFAULT_AREA_CATEGORY_KEYS;
  for (const rawKey of seeds) {
    const key = normalizeCategoryKey(rawKey);
    if (!key || byKey.has(key)) continue;
    const label = isShopCategoryId(key) ? shopCategoryById(key).label : humanizeCategoryKey(key);
    byKey.set(key, { label, sortOrder: MEDIA_ONLY_SORT_BASE + mediaOnlyIndex });
    mediaOnlyIndex += 1;
  }

  return [...byKey.entries()]
    .map(([key, acc]) => ({
      key,
      label: acc.label,
      headline: designStudioCategoryHeadline(key, acc.label),
      sortOrder: acc.sortOrder,
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const labelCmp = a.label.localeCompare(b.label, "de");
      if (labelCmp !== 0) return labelCmp;
      return a.key.localeCompare(b.key, "de");
    });
}

/** Admin-configured product badges only — never infer popularity or stock. */

export const PRODUCT_BADGE_KEYS = ["bestseller", "new", "limited", "premium"] as const;
export type ProductBadgeKey = (typeof PRODUCT_BADGE_KEYS)[number];

const LABELS: Record<ProductBadgeKey, string> = {
  bestseller: "Bestseller",
  new: "Neu",
  limited: "Limitiert",
  premium: "Premium",
};

export function productBadgeLabel(badgeKey: string | null | undefined): string | null {
  if (!badgeKey) return null;
  return LABELS[badgeKey as ProductBadgeKey] ?? null;
}

export function isProductBadgeKey(value: string): value is ProductBadgeKey {
  return (PRODUCT_BADGE_KEYS as readonly string[]).includes(value);
}

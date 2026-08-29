import * as React from "react";

import { useShopProductRow } from "@/hooks/useShopProductRow";
import type { ShopProductGroup } from "@/lib/shop/display";

export function useShopProductGroupRow(
  group: ShopProductGroup,
  rate: number | null,
  favoriteProductIds: Set<string>,
) {
  const defaultProductId = group.variants[0]?.id ?? "";
  const [selectedProductId, setSelectedProductId] = React.useState(defaultProductId);

  const activeProductId = group.variants.some((variant) => variant.id === selectedProductId)
    ? selectedProductId
    : defaultProductId;

  const product = group.variants.find((variant) => variant.id === activeProductId) ?? group.variants[0];

  const isFavorite = favoriteProductIds.has(product.id);
  const row = useShopProductRow(product, rate, isFavorite);

  return {
    product,
    selectedProductId: activeProductId,
    setSelectedProductId,
    hasMultipleVariants: group.variants.length > 1,
    ...row,
  };
}

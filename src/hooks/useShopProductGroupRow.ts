import * as React from "react";

import { useShopProductRow } from "@/hooks/useShopProductRow";
import { shopQuantityOptions, type ShopProductGroup } from "@/lib/shop/display";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { shopCategoryIdFor } from "@/lib/shopCategories";

export function useShopProductGroupRow(
  group: ShopProductGroup,
  rate: number | null,
  favoriteProductIds: Set<string>,
  saleMode: "catalog" | "retail_unit" = "catalog",
  categoryId?: ShopCategoryId,
) {
  const defaultProductId = group.variants[0]?.id ?? "";
  const [selectedProductId, setSelectedProductId] = React.useState(defaultProductId);

  const activeProductId = group.variants.some((variant) => variant.id === selectedProductId)
    ? selectedProductId
    : defaultProductId;

  const product = group.variants.find((variant) => variant.id === activeProductId) ?? group.variants[0];

  const isFavorite = favoriteProductIds.has(product.id);
  const qtyCategory = categoryId ?? shopCategoryIdFor(product);
  const quantityOptions = shopQuantityOptions(qtyCategory, saleMode);
  const row = useShopProductRow(product, rate, isFavorite, quantityOptions);

  return {
    product,
    selectedProductId: activeProductId,
    setSelectedProductId,
    hasMultipleVariants: group.variants.length > 1,
    ...row,
  };
}

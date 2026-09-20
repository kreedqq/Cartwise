import * as React from "react";

import { CreateKitRequestDialog } from "@/components/kit-requests/CreateKitRequestDialog";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { SHOP_GRID } from "@/lib/design/tokens";
import { parseShopCatalogSort, sortShopProductGroups } from "@/lib/shop/catalogSort";
import { groupAndSortShopProducts } from "@/lib/shop/display";
import { isRetailPricing, type ShopPricingProfile } from "@/lib/shop/shopAreas";
import type { AreaCategoryAssignment } from "@/lib/shop/areaCategories";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { shopCategoryIdFor } from "@/lib/shopCategories";
import type { Tables } from "@/types/database";

interface ShopProductGridProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
  categoryId?: ShopCategoryId;
  areaCategoryKey?: string;
  categoryLabel?: string;
  categoryAssignments?: readonly AreaCategoryAssignment[];
  pricingProfile?: ShopPricingProfile;
  rateLoading?: boolean;
  sort?: string;
  onKitCreated?: (id: string) => void;
}

export function ShopProductGrid({
  products,
  rate,
  favoriteProductIds,
  categoryId,
  areaCategoryKey,
  categoryLabel,
  categoryAssignments,
  pricingProfile = "group_buy",
  rateLoading = false,
  sort = "",
  onKitCreated,
}: ShopProductGridProps) {
  const { shopArea } = useShopAreaContext();
  const groups = React.useMemo(() => {
    const base = groupAndSortShopProducts(products);
    return sortShopProductGroups(base, parseShopCatalogSort(sort));
  }, [products, sort]);
  const isRetail = isRetailPricing(pricingProfile);
  const saleMode = isRetail ? "retail_unit" : "catalog";
  const showKitShare = !isRetail;
  const resolvedCategoryId = categoryId ?? shopCategoryIdFor(products[0] ?? { category: null, name: "", code: "" });
  const [kitProductId, setKitProductId] = React.useState<string | null>(null);

  return (
    <>
      <div className={SHOP_GRID.layout} role="list" aria-label="Produktkatalog">
        {groups.map((group) => (
          <ShopProductCard
            key={group.groupKey}
            group={group}
            rate={rate}
            rateLoading={rateLoading}
            favoriteProductIds={favoriteProductIds}
            categoryLabel={categoryLabel}
            categoryId={resolvedCategoryId}
            areaCategoryKey={areaCategoryKey}
            categoryAssignments={categoryAssignments}
            saleMode={saleMode}
            showKitShare={showKitShare}
            onKitShare={(productId) => setKitProductId(productId)}
          />
        ))}
      </div>
      {showKitShare && kitProductId ? (
        <CreateKitRequestDialog
          key={kitProductId}
          shopArea={shopArea}
          initialProductId={kitProductId}
          open
          onOpenChange={(open) => {
            if (!open) setKitProductId(null);
          }}
          onCreated={(id) => {
            setKitProductId(null);
            onKitCreated?.(id);
          }}
        />
      ) : null}
    </>
  );
}

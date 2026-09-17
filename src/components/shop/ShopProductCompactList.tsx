import * as React from "react";

import { CreateKitRequestDialog } from "@/components/kit-requests/CreateKitRequestDialog";
import { ShopProductCompactRow } from "@/components/shop/ShopProductCompactRow";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { SHOP_CATALOG } from "@/lib/design/tokens";
import { groupAndSortShopProducts } from "@/lib/shop/display";
import { isRetailPricing, type ShopPricingProfile } from "@/lib/shop/shopAreas";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { shopCategoryIdFor } from "@/lib/shopCategories";
import type { Tables } from "@/types/database";

interface ShopProductCompactListProps {
  products: Tables<"products">[];
  rate: number | null;
  favoriteProductIds: Set<string>;
  categoryId?: ShopCategoryId;
  categoryLabel?: string;
  pricingProfile?: ShopPricingProfile;
  rateLoading?: boolean;
  onKitCreated?: (id: string) => void;
}

export function ShopProductCompactList({
  products,
  rate,
  favoriteProductIds,
  categoryId,
  categoryLabel,
  pricingProfile = "group_buy",
  rateLoading = false,
  onKitCreated,
}: ShopProductCompactListProps) {
  const { shopArea } = useShopAreaContext();
  const groups = groupAndSortShopProducts(products);
  const isRetail = isRetailPricing(pricingProfile);
  const saleMode = isRetail ? "retail_unit" : "catalog";
  const showKitShare = !isRetail;
  const resolvedCategoryId = categoryId ?? shopCategoryIdFor(products[0] ?? { category: null, name: "", code: "" });
  const [kitProductId, setKitProductId] = React.useState<string | null>(null);

  return (
    <>
      <div className={SHOP_CATALOG.list} role="list" aria-label="Produktliste">
        <div className={SHOP_CATALOG.rowHeader} aria-hidden>
          <span>Produkt</span>
          <span>Variante</span>
          <span>Preis</span>
          <span>Menge</span>
          <span className="text-right lg:text-left">Aktion</span>
        </div>
        {groups.map((group) => (
          <ShopProductCompactRow
            key={group.groupKey}
            group={group}
            rate={rate}
            rateLoading={rateLoading}
            favoriteProductIds={favoriteProductIds}
            categoryLabel={categoryLabel}
            categoryId={resolvedCategoryId}
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

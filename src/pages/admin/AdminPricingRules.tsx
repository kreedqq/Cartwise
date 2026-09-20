import { useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPricingRulesPanel } from "@/components/admin/AdminPricingRulesPanel";
import { isShopAreaKey, type ShopAreaKey } from "@/lib/shop/shopAreas";

export default function AdminPricingRulesPage() {
  const [searchParams] = useSearchParams();
  const areaParam = searchParams.get("area");
  const initialAreaKey: ShopAreaKey | null = isShopAreaKey(areaParam ?? "") ? (areaParam as ShopAreaKey) : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Preisregeln"
        description="Zentrale Verwaltung der Verkaufspreise pro Verkaufsbereich und Rolle."
      />
      <AdminPricingRulesPanel key={initialAreaKey ?? "default-area"} initialAreaKey={initialAreaKey} />
    </div>
  );
}

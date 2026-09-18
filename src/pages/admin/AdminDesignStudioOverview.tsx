import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AdminSection } from "@/components/admin/AdminSection";
import { parseDesignStudioConfig } from "@/lib/designStudio";
import { BUILTIN_PORTAL_ASSETS } from "@/lib/shop/portalAssets";
import { QUERY_KEYS } from "@/lib/constants";
import { useSiteDesign } from "@/hooks/useTrustExperience";
import { listAdminShopAreas } from "@/services/shopAreas";
import { listAllProducts } from "@/services/products";

export default function AdminDesignStudioOverview() {
  const siteDesign = useSiteDesign();
  const areasQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreas,
    queryFn: listAdminShopAreas,
  });
  const productsQuery = useQuery({
    queryKey: ["admin-products", "design-studio-overview"],
    queryFn: () => listAllProducts({ search: "" }),
  });

  const studio = parseDesignStudioConfig(siteDesign.data?.config);
  const areas = areasQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const productCount = products.length;
  const withProductImage = products.filter((p) => p.image_path?.trim()).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AdminSection title="Portal-Assets" padded>
        <p className="text-2xl font-semibold tabular-nums">{BUILTIN_PORTAL_ASSETS.length}</p>
        <p className="text-sm text-muted-foreground">Built-in Portale (Referenz-Sheet)</p>
        <Link to="/admin/design-studio/portals" className="mt-2 inline-block text-sm font-medium text-primary">
          Portal-Bibliothek →
        </Link>
      </AdminSection>
      <AdminSection title="Vial-Bibliothek" padded>
        <p className="text-2xl font-semibold tabular-nums">{studio.vialLibrary.length}</p>
        <p className="text-sm text-muted-foreground">Hochgeladene Vials</p>
        <Link to="/admin/design-studio/vials" className="mt-2 inline-block text-sm font-medium text-primary">
          Vials verwalten →
        </Link>
      </AdminSection>
      <AdminSection title="Shop-Bereiche" padded>
        <p className="text-2xl font-semibold tabular-nums">{areas.length}</p>
        <p className="text-sm text-muted-foreground">Dynamische Verkaufsbereiche</p>
        <Link to="/admin/shop-areas" className="mt-2 inline-block text-sm font-medium text-primary">
          Bereichsdesign →
        </Link>
      </AdminSection>
      <AdminSection title="Produktbilder" padded>
        <p className="text-2xl font-semibold tabular-nums">
          {withProductImage}/{productCount}
        </p>
        <p className="text-sm text-muted-foreground">Produkte mit eigenem Bild</p>
        <Link to="/admin/products" className="mt-2 inline-block text-sm font-medium text-primary">
          Produkte →
        </Link>
      </AdminSection>
      <AdminSection title="Globales Design" padded>
        <p className="text-sm text-muted-foreground">
          Hintergrund: {siteDesign.data?.enabled ? "aktiv" : "aus"}
        </p>
        <Link to="/admin/design-studio/global" className="mt-2 inline-block text-sm font-medium text-primary">
          Globales Design →
        </Link>
      </AdminSection>
    </div>
  );
}

import { BookOpen, ClipboardList, Layers, LayoutDashboard, LayoutGrid, ShoppingBag, Star, User, UserCircle, Users, type LucideIcon } from "lucide-react";

import { SHOP_AREA_SHORT_LABELS, type MyShopArea } from "@/lib/shop/shopAreas";

export const PEPTIDE_NAV_LABEL = "Lexikon & Rechner";

export const MAIN_NAV_ITEMS = [
  { to: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/kit-gesuche", label: "Kit Gesuche", shortLabel: "Kits", icon: Layers },
  { to: "/peptide", label: PEPTIDE_NAV_LABEL, icon: BookOpen },
  { to: "/orders", label: "Meine Bestellungen", icon: ClipboardList },
  { to: "/favorites", label: "Favoriten", icon: Star },
  { to: "/profile", label: "Profil", icon: User },
] as const;

export interface CustomerNavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  end?: boolean;
}

export function buildCustomerNavItems(areas: MyShopArea[]): CustomerNavItem[] {
  const shopItems: CustomerNavItem[] = (areas.length > 0 ? areas : [{ key: "shop", name: "Shop", path: "/shop", pricing_profile: "retail", sort_order: 10 } as MyShopArea]).map(
    (area) => ({
      to: area.path,
      label: area.name,
      shortLabel: SHOP_AREA_SHORT_LABELS[area.key] ?? area.name,
      icon: area.key === "shop" ? ShoppingBag : Users,
      end: area.path === "/shop",
    }),
  );
  const showKits = areas.some((area) => area.pricing_profile === "group_buy");
  return [
    { to: "/dashboard", label: "Übersicht", icon: LayoutGrid },
    ...shopItems,
    ...(showKits ? [{ to: "/kit-gesuche", label: "Kit Gesuche", shortLabel: "Kits", icon: Layers }] : []),
    { to: "/peptide", label: PEPTIDE_NAV_LABEL, icon: BookOpen },
    { to: "/orders", label: "Meine Bestellungen", icon: ClipboardList },
    { to: "/favorites", label: "Favoriten", icon: Star },
    { to: "/profile", label: "Profil", icon: UserCircle },
  ];
}

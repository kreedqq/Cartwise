import { BookOpen, ClipboardList, LayoutGrid, ShoppingBag, UserCircle, type LucideIcon } from "lucide-react";

import type { MyShopArea } from "@/lib/shop/shopAreas";

export const PEPTIDE_NAV_LABEL = "Lexikon & Rechner";

export interface CustomerNavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  end?: boolean;
}

export function buildCustomerNavItems(_areas: MyShopArea[]): CustomerNavItem[] {
  return [
    { to: "/dashboard", label: "Übersicht", icon: LayoutGrid },
    { to: "/shop", label: "Shop", icon: ShoppingBag, end: true },
    { to: "/peptide", label: PEPTIDE_NAV_LABEL, icon: BookOpen },
    { to: "/orders", label: "Meine Bestellungen", icon: ClipboardList },
    { to: "/profile", label: "Profil", icon: UserCircle },
  ];
}

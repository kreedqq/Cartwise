import { BookOpen, ClipboardList, LayoutGrid, Newspaper, ShoppingBag, Star, UserCircle, type LucideIcon } from "lucide-react";

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
    { to: "/announcements", label: "Ankündigungen", icon: Newspaper },
    { to: "/dashboard", label: "Übersicht", icon: LayoutGrid },
    { to: "/shop", label: "Shop", icon: ShoppingBag, end: true },
    { to: "/feedback", label: "Feedback", icon: Star },
    { to: "/peptide", label: PEPTIDE_NAV_LABEL, icon: BookOpen },
    { to: "/orders", label: "Meine Bestellungen", icon: ClipboardList },
    { to: "/profile", label: "Profil", icon: UserCircle },
  ];
}

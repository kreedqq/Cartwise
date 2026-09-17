import { BookOpen, ClipboardList, LayoutGrid, Newspaper, ShoppingBag, Star, UserCircle, type LucideIcon } from "lucide-react";

import type { MyShopArea } from "@/lib/shop/shopAreas";

export const PEPTIDE_NAV_LABEL = "Lexikon & Rechner";

export interface CustomerNavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  end?: boolean;
  /** Secondary items are rendered after a divider in the sidebar / at the bottom of mobile nav */
  secondary?: boolean;
}

export function buildCustomerNavItems(_areas: MyShopArea[]): CustomerNavItem[] {
  return [
    // Primary — always-visible core navigation (Dashboard first)
    { to: "/dashboard", label: "Übersicht", shortLabel: "Start", icon: LayoutGrid },
    { to: "/shop", label: "Shop", icon: ShoppingBag, end: true },
    { to: "/orders", label: "Meine Bestellungen", shortLabel: "Bestellungen", icon: ClipboardList },
    { to: "/peptide", label: PEPTIDE_NAV_LABEL, shortLabel: "Lexikon", icon: BookOpen },
    { to: "/feedback", label: "Feedback", icon: Star },
    { to: "/profile", label: "Profil", icon: UserCircle },
    // Secondary — accessible but not primary action path
    { to: "/announcements", label: "Ankündigungen", shortLabel: "News", icon: Newspaper, secondary: true },
  ];
}

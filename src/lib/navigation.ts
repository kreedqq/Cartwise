import { BookOpen, ClipboardList, Layers, LayoutDashboard, ShoppingBag, Star, User } from "lucide-react";

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

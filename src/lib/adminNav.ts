import {
  BookOpen,
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  ScrollText,
  DollarSign,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  match: (pathname: string) => boolean;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Übersicht",
    match: (pathname) => pathname === "/admin",
    items: [{ to: "/admin", label: "Übersicht", icon: LayoutDashboard, end: true }],
  },
  {
    id: "orders",
    label: "Bestellungen",
    match: (pathname) => pathname.startsWith("/admin/orders"),
    items: [{ to: "/admin/orders", label: "Bestelleingänge", icon: ClipboardList }],
  },
  {
    id: "products",
    label: "Produkte",
    match: (pathname) =>
      pathname.startsWith("/admin/products") ||
      pathname.startsWith("/admin/pdf-import") ||
      pathname.startsWith("/admin/import-history"),
    items: [
      { to: "/admin/products", label: "Produktkatalog", icon: Package },
      { to: "/admin/pdf-import", label: "Import", icon: Upload },
      { to: "/admin/import-history", label: "Import-Verlauf", icon: History },
    ],
  },
  {
    id: "finance",
    label: "Finanzen",
    match: (pathname) =>
      pathname.startsWith("/admin/surcharges") ||
      pathname.startsWith("/admin/roles") ||
      pathname.startsWith("/admin/shipping"),
    items: [
      { to: "/admin/surcharges", label: "Rollenaufschläge", icon: DollarSign },
      { to: "/admin/roles", label: "Rollen & Preise", icon: ShieldCheck },
      { to: "/admin/shipping", label: "Versand", icon: Truck },
    ],
  },
  {
    id: "users",
    label: "Benutzer",
    match: (pathname) => pathname.startsWith("/admin/users") || pathname.startsWith("/admin/audit-log"),
    items: [
      { to: "/admin/users", label: "Benutzer", icon: Users },
      { to: "/admin/audit-log", label: "Audit-Log", icon: ScrollText },
    ],
  },
  {
    id: "content",
    label: "Inhalte",
    match: (pathname) => pathname.startsWith("/admin/research"),
    items: [{ to: "/admin/research", label: "Research", icon: BookOpen }],
  },
];

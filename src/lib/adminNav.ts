import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Palette,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";

/** Leaf link inside a nav group. */
export interface AdminNavItem {
  to: string;
  label: string;
  matchPrefix?: boolean;
  description?: string;
}

/** Top-level admin hub (sidebar group). */
export interface AdminNavGroup {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  items: AdminNavItem[];
}

/**
 * Eight top-level hubs — secondary routes nest inside (collapsed by default).
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Übersicht",
    to: "/admin",
    icon: LayoutDashboard,
    match: (pathname) => pathname === "/admin" || pathname === "/admin/",
    items: [],
  },
  {
    id: "orders",
    label: "Bestellungen",
    to: "/admin/orders",
    icon: ClipboardList,
    match: (pathname) =>
      pathname.startsWith("/admin/orders") ||
      pathname.startsWith("/admin/shipping") ||
      pathname.startsWith("/admin/order-summary") ||
      pathname.startsWith("/admin/kit-requests") ||
      pathname.startsWith("/admin/shipping-costs"),
    items: [
      {
        to: "/admin/orders",
        label: "Bestellungen",
        matchPrefix: true,
        description: "Bestellliste, Status, Tracking und Bestelldetails.",
      },
      {
        to: "/admin/kit-requests",
        label: "Kit Gesuche",
        matchPrefix: true,
        description: "Offene Kits, Teilnehmer und Verteilungen.",
      },
      {
        to: "/admin/order-summary",
        label: "Bestellzusammenfassung",
        description: "Produktaggregation und Export.",
      },
      {
        to: "/admin/shipping-costs",
        label: "Versand",
        description: "Versandkosten und Verteilung.",
      },
    ],
  },
  {
    id: "carts",
    label: "Warenkörbe",
    to: "/admin/carts",
    icon: ShoppingCart,
    match: (pathname) => pathname.startsWith("/admin/carts"),
    items: [
      {
        to: "/admin/carts",
        label: "Warenkörbe",
        matchPrefix: true,
        description: "Offene Kundenwarenkörbe.",
      },
    ],
  },
  {
    id: "products",
    label: "Produkte",
    to: "/admin/products",
    icon: Package,
    match: (pathname) =>
      pathname.startsWith("/admin/products") ||
      pathname.startsWith("/admin/pdf-import") ||
      pathname.startsWith("/admin/import-history"),
    items: [
      {
        to: "/admin/products",
        label: "Produkte",
        matchPrefix: true,
        description: "Produktstamm durchsuchen und bearbeiten.",
      },
      {
        to: "/admin/products/create",
        label: "Produkt anlegen",
        description: "Neues Produkt manuell anlegen.",
      },
      {
        to: "/admin/pdf-import",
        label: "Import",
        description: "Excel, CSV oder PDF importieren.",
      },
      {
        to: "/admin/import-history",
        label: "Importverlauf",
        description: "Vergangene Importe.",
      },
    ],
  },
  {
    id: "shop",
    label: "Shop",
    to: "/admin/shop-areas",
    icon: Store,
    match: (pathname) => pathname.startsWith("/admin/shop-areas"),
    items: [
      {
        to: "/admin/shop-areas",
        label: "Verkaufsbereiche",
        matchPrefix: true,
        description: "Händlerkatalog, Preise, Kategorien.",
      },
    ],
  },
  {
    id: "customers",
    label: "Kunden",
    to: "/admin/users",
    icon: Users,
    match: (pathname) =>
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/admin/roles") ||
      pathname.startsWith("/admin/surcharges"),
    items: [
      {
        to: "/admin/users",
        label: "Benutzer",
        matchPrefix: true,
        description: "Kundenkonten und Telegram.",
      },
      {
        to: "/admin/users#rollen",
        label: "Rollen",
        description: "Kundenrollen.",
      },
      {
        to: "/admin/surcharges",
        label: "Rollenaufschläge",
        description: "Aufschläge aus Bestell-Snapshots.",
      },
    ],
  },
  {
    id: "design",
    label: "Design Studio",
    to: "/admin/design-studio",
    icon: Palette,
    match: (pathname) =>
      pathname.startsWith("/admin/design-studio") || pathname.startsWith("/admin/design"),
    items: [
      {
        to: "/admin/design-studio",
        label: "Übersicht",
        description: "Design Studio Dashboard.",
      },
      {
        to: "/admin/design-studio/global",
        label: "Globales Design",
        description: "Website-Hintergründe.",
      },
      {
        to: "/admin/shop-areas",
        label: "Shop Bereiche",
        matchPrefix: true,
        description: "Portal, Hero und Bereichsthemen.",
      },
      {
        to: "/admin/design-studio/portals",
        label: "Portale",
        description: "Portal-Bibliothek und Zuweisungen.",
      },
      {
        to: "/admin/design-studio/vials",
        label: "Vials",
        description: "Vial-Bibliothek und globales Standard-Vial.",
      },
      {
        to: "/admin/products",
        label: "Produktbilder",
        matchPrefix: true,
        description: "Produktstamm und Bilder.",
      },
    ],
  },
  {
    id: "content",
    label: "Inhalte",
    to: "/admin/announcements",
    icon: ShoppingBag,
    match: (pathname) =>
      pathname.startsWith("/admin/announcements") ||
      pathname.startsWith("/admin/feedback") ||
      pathname.startsWith("/admin/research"),
    items: [
      {
        to: "/admin/announcements",
        label: "Ankündigungen",
        description: "Ankündigungen verwalten.",
      },
      {
        to: "/admin/feedback",
        label: "Bewertungen",
        description: "Kundenfeedback.",
      },
      {
        to: "/admin/research",
        label: "Research",
        description: "Research Review.",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    to: "/admin/system",
    icon: Settings2,
    match: (pathname) =>
      pathname.startsWith("/admin/system") ||
      pathname.startsWith("/admin/audit-log") ||
      pathname.startsWith("/admin/payment-methods"),
    items: [
      {
        to: "/admin/payment-methods",
        label: "Zahlungsmethoden",
        description: "Zahlungsarten.",
      },
      {
        to: "/admin/system",
        label: "Wartung",
        description: "Wartungsmodus und Schalter.",
      },
      {
        to: "/admin/audit-log",
        label: "Audit Logs",
        description: "Admin-Aktionen.",
      },
    ],
  },
];

const ADMIN_NAV_COLLAPSED_STORAGE_KEY = "peptix.adminNav.collapsed";
const ADMIN_NAV_EXPANDED_STORAGE_KEY = "peptix.adminNav.expanded";

export function adminSectionForPath(pathname: string): AdminNavGroup | undefined {
  const matches = ADMIN_NAV_GROUPS.filter((group) => group.match(pathname));
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  return matches.find((group) => group.id !== "overview") ?? matches[0];
}

export function adminTabIsActive(pathname: string, item: AdminNavItem, hash = ""): boolean {
  const [pathPart, hashPart] = item.to.split("#");
  const target = pathPart ?? item.to;
  const normalizedHash = hash.replace(/^#/, "");

  if (hashPart) {
    return pathname === target && normalizedHash === hashPart;
  }

  const pathMatches = item.matchPrefix
    ? pathname === target || pathname.startsWith(`${target}/`)
    : pathname === target;
  if (!pathMatches) return false;

  if (pathname === "/admin/users" && normalizedHash === "rollen") {
    return false;
  }
  return true;
}

export function adminActiveItem(pathname: string): AdminNavItem | undefined {
  const group = adminSectionForPath(pathname);
  if (!group) return undefined;
  const items = group.items.filter((item) => adminTabIsActive(pathname, item));
  if (items.length === 0) return undefined;
  return items.sort((a, b) => b.to.length - a.to.length)[0];
}

export function readAdminNavCollapsed(): boolean {
  try {
    return localStorage.getItem(ADMIN_NAV_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAdminNavCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(ADMIN_NAV_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore
  }
}

export function readAdminNavExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(ADMIN_NAV_EXPANDED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function writeAdminNavExpanded(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(ADMIN_NAV_EXPANDED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

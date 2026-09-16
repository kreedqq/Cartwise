import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MessageSquareHeart,
  Package,
  Palette,
  Settings2,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";

/** Leaf link inside a nav group. */
export interface AdminNavItem {
  to: string;
  label: string;
  /** Keep active for nested routes such as `/admin/orders/:id`. */
  matchPrefix?: boolean;
  /** Optional description for page chrome. */
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
 * Single source of truth for Admin information architecture.
 * All existing routes remain reachable; labels follow German commerce vocabulary.
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
      pathname.startsWith("/admin/carts") ||
      pathname.startsWith("/admin/shipping-costs"),
    items: [
      {
        to: "/admin/orders",
        label: "Bestellungen",
        matchPrefix: true,
        description: "Bestellliste, Status, Tracking und Bestelldetails.",
      },
      {
        to: "/admin/carts",
        label: "Warenkörbe",
        matchPrefix: true,
        description: "Offene Kundenwarenkörbe verwalten und absenden.",
      },
      {
        to: "/admin/kit-requests",
        label: "Kit Gesuche",
        matchPrefix: true,
        description: "Offene Kits, Teilnehmer und Verteilungen verwalten.",
      },
      {
        to: "/admin/order-summary",
        label: "Bestellzusammenfassung",
        description: "Produktaggregation, Kit-Zusammenfassung, PDF und CSV.",
      },
      {
        to: "/admin/shipping-costs",
        label: "Versand",
        description: "China- und Deutschland-Versandkosten sowie Verteilung.",
      },
    ],
  },
  {
    id: "catalog",
    label: "Produkte & Katalog",
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
        description: "Globaler Produktstamm: Codes, Varianten und Status.",
      },
      {
        to: "/admin/pdf-import",
        label: "Import",
        description: "Globalen Produktstamm aus PDF, CSV oder XLSX importieren.",
      },
      {
        to: "/admin/import-history",
        label: "Importverlauf",
        description: "Vergangene Importe in den globalen Produktstamm.",
      },
    ],
  },
  {
    id: "shop-areas",
    label: "Shop Bereiche",
    to: "/admin/shop-areas",
    icon: Store,
    match: (pathname) => pathname.startsWith("/admin/shop-areas"),
    items: [
      {
        to: "/admin/shop-areas",
        label: "Verkaufsbereiche",
        description: "Händlerkatalog, Produkte, Preise, Kategorien und Bereichsdesign.",
      },
    ],
  },
  {
    id: "customers",
    label: "Kunden & Rollen",
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
        description: "Kundenkonten, Telegram-Verbindung und Username.",
      },
      {
        to: "/admin/users#rollen",
        label: "Rollen",
        description: "Kundenrollen und Preisaufschläge konfigurieren.",
      },
      {
        to: "/admin/surcharges",
        label: "Rollenaufschläge",
        description: "Tatsächliche Rollenaufschläge aus Bestell-Snapshots.",
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Inhalte",
    to: "/admin/announcements",
    icon: ShoppingBag,
    match: (pathname) =>
      pathname.startsWith("/admin/announcements") || pathname.startsWith("/admin/research"),
    items: [
      {
        to: "/admin/announcements",
        label: "Ankündigungen",
        description: "Ankündigungen erstellen, veröffentlichen und sortieren.",
      },
      {
        to: "/admin/research",
        label: "Research",
        description: "Research Review und Substanz-Zuordnung.",
      },
    ],
  },
  {
    id: "design",
    label: "Design",
    to: "/admin/design",
    icon: Palette,
    match: (pathname) => pathname.startsWith("/admin/design"),
    items: [
      {
        to: "/admin/design",
        label: "Globales Design",
        description: "Website-Hintergründe und globale Darstellung.",
      },
    ],
  },
  {
    id: "reviews",
    label: "Bewertungen",
    to: "/admin/feedback",
    icon: MessageSquareHeart,
    match: (pathname) => pathname.startsWith("/admin/feedback"),
    items: [],
  },
  {
    id: "payments",
    label: "Zahlungen",
    to: "/admin/payment-methods",
    icon: CreditCard,
    match: (pathname) => pathname.startsWith("/admin/payment-methods"),
    items: [
      {
        to: "/admin/payment-methods",
        label: "Zahlungsmethoden",
        description: "PayPal, Banküberweisung und weitere Zahlungsarten.",
      },
    ],
  },
  {
    id: "system",
    label: "System & Sicherheit",
    to: "/admin/system",
    icon: Settings2,
    match: (pathname) =>
      pathname.startsWith("/admin/system") || pathname.startsWith("/admin/audit-log"),
    items: [
      {
        to: "/admin/system",
        label: "Wartung",
        description: "Wartungsmodus und globale Shop-Schalter.",
      },
      {
        to: "/admin/audit-log",
        label: "Audit Logs",
        description: "Nachvollziehbare Admin-Aktionen und Systemereignisse.",
      },
    ],
  },
];

const ADMIN_NAV_COLLAPSED_STORAGE_KEY = "peptix.adminNav.collapsed";
const ADMIN_NAV_EXPANDED_STORAGE_KEY = "peptix.adminNav.expanded";

export function adminSectionForPath(pathname: string): AdminNavGroup | undefined {
  // Prefer the most specific non-overview match; overview only when exact /admin.
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

  // Hash siblings on the same path (e.g. Benutzer vs Rollen).
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
  // Prefer the longest matching prefix (e.g. kit-requests over orders when both matchPrefix).
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
    // ignore quota / private mode
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

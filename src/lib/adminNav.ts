export interface AdminNavItem {
  to: string;
  label: string;
  /** Keep the tab active for nested routes such as `/admin/orders/:id`. */
  matchPrefix?: boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  to: string;
  match: (pathname: string) => boolean;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Übersicht",
    to: "/admin",
    match: (pathname) => pathname === "/admin",
    items: [],
  },
  {
    id: "orders",
    label: "Bestellungen",
    to: "/admin/orders",
    match: (pathname) =>
      pathname.startsWith("/admin/orders") ||
      pathname.startsWith("/admin/shipping") ||
      pathname.startsWith("/admin/order-summary"),
    items: [
      { to: "/admin/orders", label: "Übersicht", matchPrefix: true },
      { to: "/admin/order-summary", label: "Bestell Zusammenfassung" },
      { to: "/admin/shipping-costs", label: "Versandkosten" },
    ],
  },
  {
    id: "products",
    label: "Produkte",
    to: "/admin/products",
    match: (pathname) =>
      pathname.startsWith("/admin/products") ||
      pathname.startsWith("/admin/pdf-import") ||
      pathname.startsWith("/admin/import-history"),
    items: [
      { to: "/admin/products", label: "Produktkatalog" },
      { to: "/admin/pdf-import", label: "Import" },
      { to: "/admin/import-history", label: "Import-Verlauf" },
    ],
  },
  {
    id: "users",
    label: "Benutzer & Rollen",
    to: "/admin/users",
    match: (pathname) =>
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/admin/roles") ||
      pathname.startsWith("/admin/surcharges") ||
      pathname.startsWith("/admin/audit-log"),
    items: [
      { to: "/admin/users", label: "Benutzer & Rollen" },
      { to: "/admin/surcharges", label: "Rollenaufschläge" },
      { to: "/admin/audit-log", label: "Audit-Log" },
    ],
  },
  {
    id: "content",
    label: "Inhalte",
    to: "/admin/research",
    match: (pathname) => pathname.startsWith("/admin/research"),
    items: [{ to: "/admin/research", label: "Research" }],
  },
];

export function adminSectionForPath(pathname: string): AdminNavGroup | undefined {
  return ADMIN_NAV_GROUPS.find((group) => group.match(pathname));
}

export function adminTabIsActive(pathname: string, item: AdminNavItem): boolean {
  if (item.matchPrefix) {
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }
  return pathname === item.to;
}

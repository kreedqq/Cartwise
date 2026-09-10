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
    id: "announcements",
    label: "Ankündigungen",
    to: "/admin/announcements",
    match: (pathname) => pathname === "/admin/announcements" || pathname.startsWith("/admin/announcements/"),
    items: [],
  },
  {
    id: "design",
    label: "Design",
    to: "/admin/design",
    match: (pathname) => pathname === "/admin/design" || pathname.startsWith("/admin/design/"),
    items: [],
  },
  {
    id: "feedback",
    label: "Feedback",
    to: "/admin/feedback",
    match: (pathname) => pathname === "/admin/feedback" || pathname.startsWith("/admin/feedback/"),
    items: [],
  },
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
      pathname.startsWith("/admin/order-summary") ||
      pathname.startsWith("/admin/surcharges"),
    items: [
      { to: "/admin/orders", label: "Übersicht", matchPrefix: true },
      { to: "/admin/order-summary", label: "Bestell Zusammenfassung" },
      { to: "/admin/surcharges", label: "Rollenaufschläge" },
      { to: "/admin/shipping-costs", label: "Versandkosten" },
    ],
  },
  {
    id: "products",
    label: "Produkte",
    to: "/admin/products",
    match: (pathname) =>
      pathname.startsWith("/admin/products") ||
      pathname.startsWith("/admin/shop-areas") ||
      pathname.startsWith("/admin/pdf-import") ||
      pathname.startsWith("/admin/import-history"),
    items: [
      { to: "/admin/products", label: "Produktkatalog" },
      { to: "/admin/shop-areas", label: "Verkaufsbereiche" },
    ],
  },
  {
    id: "users",
    label: "Benutzer & Rollen",
    to: "/admin/users",
    match: (pathname) =>
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/admin/roles") ||
      pathname.startsWith("/admin/audit-log"),
    items: [
      { to: "/admin/users", label: "Benutzer & Rollen" },
      { to: "/admin/audit-log", label: "Audit-Log" },
    ],
  },
  {
    id: "content",
    label: "Inhalte",
    to: "/admin/research",
    match: (pathname) => pathname.startsWith("/admin/research"),
    items: [
      { to: "/admin/research", label: "Research" },
    ],
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

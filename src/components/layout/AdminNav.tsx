import {
  BookOpen,
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  ScrollText,
  ShieldCheck,
  Truck,
  Upload,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

const GROUPS = [
  {
    items: [
      { to: "/admin", label: "Übersicht", icon: LayoutDashboard, end: true },
      { to: "/admin/orders", label: "Bestellungen", icon: ClipboardList },
    ],
  },
  {
    items: [
      { to: "/admin/products", label: "Produkte", icon: Package },
      { to: "/admin/pdf-import", label: "Import", icon: Upload },
      { to: "/admin/import-history", label: "Import-Verlauf", icon: History },
    ],
  },
  {
    items: [
      { to: "/admin/users", label: "Benutzer", icon: Users },
      { to: "/admin/roles", label: "Rollen & Preise", icon: ShieldCheck },
      { to: "/admin/shipping", label: "Versand", icon: Truck },
    ],
  },
  {
    items: [
      { to: "/admin/audit-log", label: "Audit-Log", icon: ScrollText },
      { to: "/admin/research", label: "Research", icon: BookOpen },
    ],
  },
];

export function AdminNav() {
  return (
    <nav
      className="flex items-center gap-0.5 overflow-x-auto pb-0 no-scrollbar"
      aria-label="Admin-Navigation"
    >
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && (
            <span className="mx-2 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")}
                    aria-hidden="true"
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

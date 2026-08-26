import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Übersicht", end: true },
  { to: "/admin/products", label: "Produkte" },
  { to: "/admin/pdf-import", label: "Produktimport" },
  { to: "/admin/import-history", label: "Import-Historie" },
  { to: "/admin/users", label: "Benutzer" },
  { to: "/admin/audit-log", label: "Audit-Log" },
];

export function AdminNav() {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

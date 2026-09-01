import { NavLink } from "react-router-dom";
import { BookOpen, ClipboardList, Layers, LayoutGrid, ShieldCheck, ShoppingBag, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";
import { BrandMark } from "@/components/layout/BrandMark";
import { useNavShell } from "@/context/NavShellProvider";
import { PEPTIDE_NAV_LABEL } from "@/lib/navigation";

const navItems = [
  { to: "/dashboard", label: "Übersicht", icon: LayoutGrid },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/kit-gesuche", label: "Kit Gesuche", icon: Layers },
  { to: "/peptide", label: PEPTIDE_NAV_LABEL, icon: BookOpen },
  { to: "/orders", label: "Meine Bestellungen", icon: ClipboardList },
  { to: "/profile", label: "Profil", icon: UserCircle },
];

export function Sidebar() {
  const { isAdmin } = useAuth();
  const { sidebarCollapsed } = useNavShell();

  return (
    <aside
      className={cn(
        "hidden shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col",
        sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-[15.5rem] opacity-100",
      )}
    >
      <div className="flex min-h-[4.5rem] items-center px-4 py-2 lg:min-h-24 lg:px-5">
        <BrandMark inverted variant="sidebar" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium tracking-wide transition-colors",
                isActive
                  ? "bg-primary/12 text-primary"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="px-3 pb-1 pt-8 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">
              Intern
            </div>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium tracking-wide transition-colors",
                  isActive
                    ? "bg-primary/12 text-primary"
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Admin
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}

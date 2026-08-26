import { NavLink } from "react-router-dom";
import { LayoutDashboard, ShieldCheck, UserCircle, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";
import { APP_NAME } from "@/lib/constants";

const navItems = [
  { to: "/dashboard", label: "Warenkörbe", icon: LayoutDashboard },
  { to: "/profile", label: "Profil", icon: UserCircle },
];

export function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card/50 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShoppingCart className="h-4.5 w-4.5" />
        </div>
        <span className="text-sm font-semibold leading-tight">{APP_NAME}</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Administration
            </div>
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Admin-Dashboard
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}

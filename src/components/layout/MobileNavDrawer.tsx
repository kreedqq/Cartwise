import { NavLink } from "react-router-dom";
import { BookOpen, ClipboardList, Layers, LayoutGrid, ShieldCheck, ShoppingBag, UserCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";
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

export function MobileNavDrawer() {
  const { isAdmin } = useAuth();
  const { mobileNavOpen, closeMobileNav } = useNavShell();

  if (!mobileNavOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Navigation schließen"
        onClick={closeMobileNav}
      />
      <aside className="relative flex h-full w-[min(18rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
        <div className="flex h-16 items-center justify-end px-4">
          <Button variant="ghost" size="icon" onClick={closeMobileNav} aria-label="Navigation schließen">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMobileNav}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium tracking-wide transition-colors",
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
              <div className="px-3 pb-1 pt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">
                Intern
              </div>
              <NavLink
                to="/admin"
                onClick={closeMobileNav}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium tracking-wide transition-colors",
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
    </div>
  );
}

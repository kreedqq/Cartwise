import { NavLink } from "react-router-dom";
import { BookOpen, ClipboardList, Layers, LayoutGrid, ShieldCheck, ShoppingBag, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";
import { PEPTIDE_NAV_LABEL } from "@/lib/navigation";

const items = [
  { to: "/dashboard", label: "Übersicht", icon: LayoutGrid },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/kit-gesuche", label: "Kits", icon: Layers },
  { to: "/peptide", label: PEPTIDE_NAV_LABEL, icon: BookOpen },
  { to: "/orders", label: "Meine Bestellungen", icon: ClipboardList },
  { to: "/profile", label: "Profil", icon: UserCircle },
];

export function MobileNav() {
  const { isAdmin } = useAuth();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground lg:hidden">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[9px] font-medium leading-tight tracking-wide",
              isActive ? "text-primary" : "text-sidebar-muted",
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="max-w-full text-center">{item.label}</span>
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            cn(
              "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[9px] font-medium leading-tight tracking-wide",
              isActive ? "text-primary" : "text-sidebar-muted",
            )
          }
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="max-w-full text-center">Admin</span>
        </NavLink>
      )}
    </nav>
  );
}

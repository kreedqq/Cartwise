import { NavLink } from "react-router-dom";
import { LayoutDashboard, ShieldCheck, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";

export function MobileNav() {
  const { isAdmin } = useAuth();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur lg:hidden">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium",
            isActive ? "text-primary" : "text-muted-foreground",
          )
        }
      >
        <LayoutDashboard className="h-5 w-5" />
        Warenkörbe
      </NavLink>
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium",
            isActive ? "text-primary" : "text-muted-foreground",
          )
        }
      >
        <UserCircle className="h-5 w-5" />
        Profil
      </NavLink>
      {isAdmin && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium",
              isActive ? "text-primary" : "text-muted-foreground",
            )
          }
        >
          <ShieldCheck className="h-5 w-5" />
          Admin
        </NavLink>
      )}
    </nav>
  );
}

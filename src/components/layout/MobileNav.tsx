import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";
import { useCustomerNavItems } from "@/hooks/useCustomerNavItems";

export function MobileNav() {
  const { isAdmin } = useAuth();
  const { items } = useCustomerNavItems();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground lg:hidden [[data-site-background=on]_&]:bg-sidebar/55 [[data-site-background=on]_&]:backdrop-blur-md">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[9px] font-medium leading-tight tracking-wide",
              isActive ? "text-primary" : "text-sidebar-muted",
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="max-w-full text-center">{item.shortLabel ?? item.label}</span>
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

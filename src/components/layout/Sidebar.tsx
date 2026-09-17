import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";
import { BrandMark } from "@/components/layout/BrandMark";
import { useNavShell } from "@/context/NavShellProvider";
import { useCustomerNavItems } from "@/hooks/useCustomerNavItems";

export function Sidebar() {
  const { isAdmin } = useAuth();
  const { sidebarCollapsed } = useNavShell();
  const { items } = useCustomerNavItems();

  return (
    <aside
      className={cn(
        "relative z-10 hidden shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col",
        "before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-primary/20",
        "[[data-site-background=on]_&]:bg-sidebar/50 [[data-site-background=on]_&]:backdrop-blur-md [[data-site-background=on]_&]:backdrop-saturate-125",
        sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-[15.5rem] opacity-100",
      )}
    >
      <div className="flex min-h-16 items-center px-5 lg:min-h-[4.5rem]">
        <BrandMark inverted variant="sidebar" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        {items.filter((i) => !i.secondary).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium tracking-wide transition-colors",
                isActive
                  ? "bg-primary/10 text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-primary"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {items.some((i) => i.secondary) && (
          <>
            <div className="px-3 pb-1 pt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">
              Mehr
            </div>
            {items.filter((i) => i.secondary).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                "relative flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium tracking-wide transition-colors",
                isActive
                  ? "bg-primary/10 text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-primary"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div className="px-3 pb-1 pt-8 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">
              Intern
            </div>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                "relative flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium tracking-wide transition-colors",
                isActive
                  ? "bg-primary/10 text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-primary"
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

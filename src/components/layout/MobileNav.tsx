import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthProvider";
import { useCustomerNavItems } from "@/hooks/useCustomerNavItems";

export function MobileNav() {
  const { isAdmin } = useAuth();
  const { items } = useCustomerNavItems();
  const location = useLocation();
  const scrollerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const active = scrollerRef.current?.querySelector<HTMLElement>("[data-active=true]");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [location.pathname]);

  return (
    <nav
      ref={scrollerRef}
      className="fixed inset-x-0 bottom-0 z-40 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:hidden [[data-site-background=on]_&]:bg-sidebar/55 [[data-site-background=on]_&]:backdrop-blur-md"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          data-active={location.pathname === item.to || (!item.end && location.pathname.startsWith(`${item.to}/`)) || undefined}
          className={({ isActive }) =>
            cn(
              "flex min-h-12 w-[4.75rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium leading-tight tracking-wide",
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
          data-active={location.pathname.startsWith("/admin") || undefined}
          className={({ isActive }) =>
            cn(
              "flex min-h-12 w-[4.75rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium leading-tight tracking-wide",
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

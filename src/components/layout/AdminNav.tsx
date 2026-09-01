import { NavLink, useLocation } from "react-router-dom";

import { ADMIN_NAV_GROUPS, adminSectionForPath, adminTabIsActive } from "@/lib/adminNav";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const { pathname } = useLocation();
  const activeGroup = adminSectionForPath(pathname);

  return (
    <nav className="space-y-3" aria-label="Admin-Navigation">
      <div className="flex flex-wrap items-center gap-0.5">
        {ADMIN_NAV_GROUPS.map((group) => {
          const active = group.id === activeGroup?.id;
          return (
            <NavLink
              key={group.id}
              to={group.to}
              end={group.id === "overview"}
              className={cn(
                "flex shrink-0 items-center rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {group.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminSectionTabs() {
  const { pathname } = useLocation();
  const group = adminSectionForPath(pathname);
  if (!group || group.items.length === 0) return null;

  return (
    <nav className="mb-5" aria-label={`${group.label} Bereiche`}>
      <div className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg bg-secondary p-1">
        {group.items.map((item) => {
          const active = adminTabIsActive(pathname, item);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

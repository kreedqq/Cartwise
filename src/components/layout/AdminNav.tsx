import { NavLink, useLocation } from "react-router-dom";

import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/lib/adminNav";
import { cn } from "@/lib/utils";

function NavItemLink({ item }: { item: AdminNavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")}
            aria-hidden="true"
          />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export function AdminNav() {
  const { pathname } = useLocation();
  const activeGroup = ADMIN_NAV_GROUPS.find((group) => group.match(pathname)) ?? ADMIN_NAV_GROUPS[0];
  const showSubnav = (activeGroup?.items.length ?? 0) > 1;

  return (
    <nav className="space-y-2" aria-label="Admin-Navigation">
      <div className="flex flex-wrap items-center gap-0.5">
        {ADMIN_NAV_GROUPS.map((group) => {
          const active = group.id === activeGroup?.id;
          const target = group.items[0];
          if (!target) return null;
          return (
            <NavLink
              key={group.id}
              to={target.to}
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
      {showSubnav && activeGroup && (
        <div className="flex flex-wrap items-center gap-0.5 border-t border-border pt-2">
          {activeGroup.items.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </div>
      )}
    </nav>
  );
}

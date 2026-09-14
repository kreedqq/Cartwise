import * as React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ADMIN_NAV_GROUPS,
  adminTabIsActive,
  readAdminNavCollapsed,
  readAdminNavExpanded,
  writeAdminNavCollapsed,
  writeAdminNavExpanded,
  type AdminNavGroup,
} from "@/lib/adminNav";
import { cn } from "@/lib/utils";

function GroupChildren({
  group,
  collapsed,
  onNavigate,
}: {
  group: AdminNavGroup;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { pathname, hash } = useLocation();
  if (group.items.length === 0 || collapsed) return null;

  return (
    <ul className="mt-0.5 space-y-0.5 border-l border-border/70 ml-4 pl-2">
      {group.items.map((item) => {
        const active = adminTabIsActive(pathname, item, hash);
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
              )}
            >
              {item.label}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarGroup({
  group,
  collapsed,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: AdminNavGroup;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const sectionActive = group.match(pathname);
  const Icon = group.icon;
  const hasChildren = group.items.length > 0;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-0.5">
        <NavLink
          to={group.to}
          end={group.id === "overview"}
          title={collapsed ? group.label : undefined}
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium tracking-wide transition-colors",
            sectionActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed ? <span className="truncate">{group.label}</span> : null}
        </NavLink>
        {!collapsed && hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-label={expanded ? `${group.label} einklappen` : `${group.label} ausklappen`}
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </Button>
        ) : null}
      </div>
      {expanded ? <GroupChildren group={group} collapsed={collapsed} onNavigate={onNavigate} /> : null}
    </div>
  );
}

function useAdminNavState() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = React.useState(() => readAdminNavCollapsed());
  const [expandedMap, setExpandedMap] = React.useState(() => readAdminNavExpanded());

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeAdminNavCollapsed(next);
      return next;
    });
  }

  function toggleGroup(id: string) {
    setExpandedMap((prev) => {
      const currentlyOpen =
        prev[id] != null ? Boolean(prev[id]) : ADMIN_NAV_GROUPS.find((g) => g.id === id)?.match(pathname) === true;
      const next = { ...prev, [id]: !currentlyOpen };
      writeAdminNavExpanded(next);
      return next;
    });
  }

  function isExpanded(group: AdminNavGroup): boolean {
    if (group.items.length === 0) return false;
    if (expandedMap[group.id] != null) return Boolean(expandedMap[group.id]);
    return group.match(pathname);
  }

  return { collapsed, toggleCollapsed, isExpanded, toggleGroup };
}

export function AdminSidebar({ className }: { className?: string }) {
  const { collapsed, toggleCollapsed, isExpanded, toggleGroup } = useAdminNavState();

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-secondary/20 lg:flex",
        collapsed ? "w-[4.25rem]" : "w-60",
        className,
      )}
      aria-label="Admin-Sidebar"
    >
      <div className={cn("flex items-center gap-2 border-b border-border px-3 py-3", collapsed && "justify-center")}>
        {!collapsed ? (
          <Link to="/admin" className="min-w-0 flex-1">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Peptix Admin
            </p>
          </Link>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Admin-Navigation">
        {ADMIN_NAV_GROUPS.map((group) => (
          <SidebarGroup
            key={group.id}
            group={group}
            collapsed={collapsed}
            expanded={isExpanded(group)}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}
      </nav>
    </aside>
  );
}

export function AdminMobileNav() {
  const [open, setOpen] = React.useState(false);
  const { isExpanded, toggleGroup } = useAdminNavState();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Peptix Admin
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-label="Admin-Menü öffnen">
          <Menu className="mr-2 h-4 w-4" />
          Menü
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Navigation schließen"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[min(20rem,90vw)] flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Peptix Admin
              </p>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Navigation schließen">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin-Navigation">
              {ADMIN_NAV_GROUPS.map((group) => (
                <SidebarGroup
                  key={group.id}
                  group={group}
                  collapsed={false}
                  expanded={isExpanded(group)}
                  onToggle={() => toggleGroup(group.id)}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer AdminSidebar + AdminMobileNav. Kept for compatibility with older imports. */
export function AdminNav() {
  return null;
}

/** Secondary in-page tabs are no longer the primary IA; kept as no-op for layout compatibility. */
export function AdminSectionTabs() {
  return null;
}

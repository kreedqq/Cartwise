import { NavLink, Outlet } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DESIGN_STUDIO_TABS } from "@/lib/designStudio";
import { cn } from "@/lib/utils";

export function DesignStudioShell() {
  return (
    <div className="space-y-4">
      <AdminPageHeader
        section="Design Studio"
        subsection="Visuelle Steuerung"
        title="Design Studio"
        description="Portale, Vials, Bereichswelten und globales Erscheinungsbild — zentral an einem Ort."
      />
      <nav
        className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/20 p-1"
        aria-label="Design Studio"
      >
        {DESIGN_STUDIO_TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={tab.id === "overview"}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

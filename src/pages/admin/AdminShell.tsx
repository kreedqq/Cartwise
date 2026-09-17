import { Link, Outlet } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

import { AdminMobileNav, AdminSidebar } from "@/components/layout/AdminNav";
import { EmergencyMaintenanceButton } from "@/components/admin/EmergencyMaintenanceButton";
import { Button } from "@/components/ui/button";
import { useResolvedSiteAccess } from "@/hooks/useAppPublicState";

/**
 * Standalone admin shell — rendered completely outside of the customer AppShell.
 * No negative-margin hacks; the admin layout owns the entire viewport.
 */
export default function AdminShell() {
  const access = useResolvedSiteAccess();

  return (
    <div
      data-admin=""
      className="flex min-h-screen bg-background"
    >
      {/* Desktop sidebar */}
      <AdminSidebar />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-6 lg:px-8">
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:inline">
            Backoffice
          </span>

          <div className="flex items-center gap-2 lg:ml-auto">
            {access.maintenanceMode ? <EmergencyMaintenanceButton /> : null}
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
              <Link to="/shop">
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                Zur Kunden-App
              </Link>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          {/* Mobile navigation drawer trigger */}
          <AdminMobileNav />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Outlet } from "react-router-dom";

import { AdminMobileNav, AdminSidebar } from "@/components/layout/AdminNav";
import { EmergencyMaintenanceButton } from "@/components/admin/EmergencyMaintenanceButton";
import { useResolvedSiteAccess } from "@/hooks/useAppPublicState";

export default function AdminLayout() {
  const access = useResolvedSiteAccess();

  return (
    <div
      data-admin=""
      className="bg-background -mx-4 -my-8 min-h-screen sm:-mx-6 lg:-mx-10"
    >
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 lg:px-8">
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:inline">
              Backoffice
            </span>
            <div className="ml-auto flex items-center gap-2">
              {access.maintenanceMode ? <EmergencyMaintenanceButton /> : null}
            </div>
          </div>
          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <AdminMobileNav />
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

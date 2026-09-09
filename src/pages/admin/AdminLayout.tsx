import { Outlet } from "react-router-dom";

import { AdminNav, AdminSectionTabs } from "@/components/layout/AdminNav";
import { EmergencyMaintenanceButton } from "@/components/admin/EmergencyMaintenanceButton";
import { useResolvedSiteAccess } from "@/hooks/useAppPublicState";

export default function AdminLayout() {
  const access = useResolvedSiteAccess();

  return (
    <div
      data-admin=""
      className="bg-background -mx-4 -my-8 min-h-screen px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 lg:py-8"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Peptix&thinsp;/&thinsp;Admin
        </span>
        {access.maintenanceMode ? <EmergencyMaintenanceButton /> : null}
      </div>

      <div className="mb-4 border-b border-border pb-3">
        <AdminNav />
      </div>

      <AdminSectionTabs />

      <Outlet />
    </div>
  );
}

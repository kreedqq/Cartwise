import { Outlet } from "react-router-dom";

import { AdminNav } from "@/components/layout/AdminNav";

export default function AdminLayout() {
  return (
    <div
      data-admin=""
      className="bg-background -mx-4 -my-8 min-h-screen px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 lg:py-8"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Peptix&thinsp;/&thinsp;Admin
        </span>
      </div>

      <div className="mb-5 border-b border-border pb-1">
        <AdminNav />
      </div>

      <Outlet />
    </div>
  );
}

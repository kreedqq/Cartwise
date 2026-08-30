import { Outlet } from "react-router-dom";

import { AdminNav } from "@/components/layout/AdminNav";
import { PageHeader } from "@/components/common/PageHeader";

export default function AdminLayout() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Peptix"
        title="Administration"
        description="Bestellungen, Produkte, Importe, Wechselkurs und Benutzerrollen."
        className="space-y-1"
      />
      <AdminNav />
      <Outlet />
    </div>
  );
}

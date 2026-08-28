import { Outlet } from "react-router-dom";

import { AdminNav } from "@/components/layout/AdminNav";
import { PageHeader } from "@/components/common/PageHeader";

export default function AdminLayout() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Peptix"
        title="Administration"
        description="Bestellungen, Produkte, Importe, Wechselkurs und Benutzerrollen verwalten."
      />
      <AdminNav />
      <Outlet />
    </div>
  );
}

import { Outlet } from "react-router-dom";

import { AdminNav } from "@/components/layout/AdminNav";

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Produktdaten, Importe, Wechselkurs und Benutzerrollen verwalten.
        </p>
      </div>
      <AdminNav />
      <Outlet />
    </div>
  );
}

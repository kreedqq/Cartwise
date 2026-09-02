import { Navigate } from "react-router-dom";

/** Deep-link compatibility: former Rollen page now lives under Benutzer & Rollen. */
export default function AdminRolesPage() {
  return <Navigate to="/admin/users" replace />;
}

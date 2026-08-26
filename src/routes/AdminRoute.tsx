import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/context/AuthProvider";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";

/**
 * Same disclaimer as ProtectedRoute: this only hides the admin UI for
 * comfort. Every admin-only table/RPC re-checks has_role(auth.uid(),
 * 'admin') server-side, so a manipulated frontend state can never grant
 * real access (see docs/SECURITY.md).
 */
export function AdminRoute() {
  const { session, isAdmin, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/403" replace />;

  return <Outlet />;
}

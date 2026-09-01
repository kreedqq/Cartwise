import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthProvider";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";

/**
 * Client-side gate for UX only (instant redirect instead of a flash of
 * protected content). The REAL enforcement is Row Level Security in
 * Postgres - every query still runs scoped to auth.uid() no matter what
 * this component does (see docs/SECURITY.md).
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;
  if (session) return <Outlet />;
  return <Navigate to="/login" replace state={{ from: location }} />;
}

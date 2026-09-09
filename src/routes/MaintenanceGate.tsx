import { Outlet, useLocation } from "react-router-dom";

import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { MaintenanceScreen } from "@/components/maintenance/MaintenanceScreen";
import { useAuth } from "@/context/AuthProvider";
import { useResolvedSiteAccess } from "@/hooks/useAppPublicState";

/**
 * Central maintenance gate. Non-admins never reach the app shell while
 * maintenance is on (or when the status cannot be loaded). /login and
 * /auth/callback stay reachable so an administrator can still authenticate.
 */
export function MaintenanceGate() {
  const location = useLocation();
  const { session, isAdmin } = useAuth();
  const access = useResolvedSiteAccess();

  if (access.isLoading) return <FullScreenSpinner />;
  if (access.allowed) return <Outlet />;

  if (location.pathname === "/auth/callback") return <Outlet />;
  if (location.pathname === "/login" && !session) return <Outlet />;
  if (location.pathname === "/login" && session && isAdmin) return <Outlet />;

  return <MaintenanceScreen />;
}

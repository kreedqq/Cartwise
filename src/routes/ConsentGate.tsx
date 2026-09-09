import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { useAuth } from "@/context/AuthProvider";
import { useResearchConsent } from "@/hooks/useConsents";

/**
 * After username is set, require the current research-terms version.
 * Checked from the session/consent query, not on every in-app interaction
 * beyond this layout gate.
 */
export function ConsentGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const consentQuery = useResearchConsent();

  if (loading || (user && consentQuery.isLoading)) return <FullScreenSpinner />;
  if (consentQuery.isError) {
    return <Navigate to="/consent" replace state={{ from: location }} />;
  }
  if (user && consentQuery.data !== true) {
    return <Navigate to="/consent" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

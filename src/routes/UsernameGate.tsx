import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthProvider";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { shouldPromptForUsername } from "@/services/username";

/**
 * After a session exists, block the app shell until the user has a Telegram
 * username and any admin-required confirmation is cleared. The duty page is
 * a sibling route so this gate cannot be skipped via in-app navigation.
 */
export function UsernameGate() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;
  if (shouldPromptForUsername({ loading, user, profile })) {
    return <Navigate to="/username-required" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

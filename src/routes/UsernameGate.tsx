import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthProvider";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { shouldPromptForUsername } from "@/services/username";

/**
 * After a session exists, block the app shell until the user has a Telegram
 * username and any admin-required Telegram linking is completed.
 *
 * Wait for profile before deciding — otherwise a fresh email login can briefly
 * pass with profile=null and miss username_required_on_next_login.
 */
export function UsernameGate() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;
  if (user && !profile) return <FullScreenSpinner label="Konto wird geladen …" />;
  if (shouldPromptForUsername({ loading: false, user, profile })) {
    return <Navigate to="/username-required" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

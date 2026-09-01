import * as React from "react";
import { useNavigate } from "react-router-dom";

import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { toast } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabaseClient";
import { completeOAuthCallback, mapAuthError, OAUTH_SUCCESS_PATH } from "@/services/auth";

/**
 * Completes the OAuth PKCE round-trip. This route always renders HTML.
 * It never returns JSON — `authorize.json` came from GoTrue `/authorize`, not here.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      toast.error("Die Anmeldung konnte nicht abgeschlossen werden. Bitte starte den Vorgang erneut.");
      navigate("/login", { replace: true });
    }, 8000);

    function go(sessionPresent: boolean) {
      if (cancelled || !sessionPresent) return;
      window.clearTimeout(timeout);
      navigate(OAUTH_SUCCESS_PATH, { replace: true });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      go(!!session);
    });

    async function complete() {
      const result = await completeOAuthCallback({
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        getSession: () => supabase.auth.getSession(),
        exchangeCodeForSession: (url) => supabase.auth.exchangeCodeForSession(url),
      });
      if (cancelled) return;
      if (result.status === "authenticated") {
        go(true);
        return;
      }
      if (result.status === "failed") {
        window.clearTimeout(timeout);
        toast.error(mapAuthError(result.message));
        navigate("/login", { replace: true });
      }
    }

    void complete();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return <FullScreenSpinner label="Anmeldung wird abgeschlossen …" />;
}

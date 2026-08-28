import * as React from "react";
import { useNavigate } from "react-router-dom";

import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { toast } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabaseClient";
import { mapAuthError, OAUTH_SUCCESS_PATH, readOAuthCallbackError } from "@/services/auth";

/**
 * Completes the OAuth PKCE round-trip. This route always renders HTML.
 * It never returns JSON — `authorize.json` came from GoTrue `/authorize`, not here.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;

    const oauthError = readOAuthCallbackError();
    if (oauthError) {
      toast.error(mapAuthError(oauthError));
      navigate("/login", { replace: true });
      return;
    }

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
      const existing = await supabase.auth.getSession();
      if (cancelled) return;
      if (existing.data.session) {
        go(true);
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (cancelled) return;
        if (error) {
          window.clearTimeout(timeout);
          toast.error(mapAuthError(error));
          navigate("/login", { replace: true });
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        window.clearTimeout(timeout);
        toast.error(mapAuthError(error));
        navigate("/login", { replace: true });
        return;
      }
      go(!!data.session);
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

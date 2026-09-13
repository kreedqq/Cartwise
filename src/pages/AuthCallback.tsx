import * as React from "react";
import { useNavigate } from "react-router-dom";

import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { toast } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabaseClient";
import { completeOAuthCallback, mapAuthError, OAUTH_SUCCESS_PATH, signOut } from "@/services/auth";
import {
  clearTelegramIdentityConflict,
  clearTelegramTransferIntent,
  clearUsernameChangeEligible,
  completeTelegramIdentityTransfer,
  isTelegramIdentityConflictError,
  markTelegramIdentityConflict,
  mapUsernameError,
  readTelegramTransferIntent,
} from "@/services/username";

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
      // Transfer completion handles navigation itself.
      if (readTelegramTransferIntent()) return;
      go(!!session);
    });

    async function complete() {
      const transferIntentId = readTelegramTransferIntent();

      const result = await completeOAuthCallback({
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        getSession: () => supabase.auth.getSession(),
        exchangeCodeForSession: (url) => supabase.auth.exchangeCodeForSession(url),
      });
      if (cancelled) return;

      if (result.status === "authenticated") {
        if (transferIntentId) {
          window.clearTimeout(timeout);
          try {
            await completeTelegramIdentityTransfer(transferIntentId);
            clearTelegramTransferIntent();
            clearTelegramIdentityConflict();
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.user?.id) clearUsernameChangeEligible(session.user.id);
            await signOut();
            toast.success("Telegram erfolgreich verknüpft. Bitte melde dich erneut mit E-Mail an.");
            navigate("/login", { replace: true });
          } catch (err) {
            clearTelegramTransferIntent();
            toast.error(mapUsernameError(err));
            await signOut();
            navigate("/login", { replace: true });
          }
          return;
        }
        go(true);
        return;
      }

      if (result.status === "failed") {
        window.clearTimeout(timeout);
        const { data } = await supabase.auth.getSession();
        if (data.session && isTelegramIdentityConflictError(result.message)) {
          markTelegramIdentityConflict();
          toast("Telegram Konto bereits verknüpft");
          navigate("/username-required", { replace: true });
          return;
        }
        toast.error(mapAuthError(result.message));
        // linkIdentity failures keep the existing PEPTIX session — return to the gate.
        navigate(data.session ? "/username-required" : "/login", { replace: true });
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

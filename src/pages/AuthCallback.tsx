import * as React from "react";
import { useNavigate } from "react-router-dom";

import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { toast } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabaseClient";
import {
  clearOAuthFlowLock,
  completeOAuthCallback,
  logOAuthCallbackDiagnostics,
  mapAuthError,
  OAUTH_SUCCESS_PATH,
  signOut,
} from "@/services/auth";
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
 * Single authoritative OAuth completion path.
 * Do not navigate from auth-state listeners here — that races URL session detection /
 * code exchange and caused false login failures plus loops.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (cancelled || settled) return;
      settled = true;
      clearOAuthFlowLock();
      toast.error("Die Anmeldung konnte nicht abgeschlossen werden. Bitte starte den Vorgang erneut.");
      navigate("/login", { replace: true });
    }, 12_000);

    async function finish(path: string) {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      clearOAuthFlowLock();
      navigate(path, { replace: true });
    }

    async function complete() {
      const href = window.location.href;
      const search = window.location.search;
      const hash = window.location.hash;
      logOAuthCallbackDiagnostics({ href, search, hash, phase: "start" });

      const transferIntentId = readTelegramTransferIntent();

      const result = await completeOAuthCallback({
        href,
        search,
        hash,
        getSession: () => supabase.auth.getSession(),
        exchangeCodeForSession: (url) => supabase.auth.exchangeCodeForSession(url),
      });
      if (cancelled) return;

      logOAuthCallbackDiagnostics({
        href,
        search,
        hash,
        phase: "result",
        status: result.status,
        message: result.status === "failed" ? result.message : undefined,
      });

      if (result.status === "authenticated") {
        if (transferIntentId) {
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
            await finish("/login");
          } catch (err) {
            clearTelegramTransferIntent();
            toast.error(mapUsernameError(err));
            await signOut();
            await finish("/login");
          }
          return;
        }
        await finish(OAUTH_SUCCESS_PATH);
        return;
      }

      if (result.status === "failed") {
        const { data } = await supabase.auth.getSession();
        if (data.session && isTelegramIdentityConflictError(result.message)) {
          markTelegramIdentityConflict();
          toast("Telegram Konto bereits verknüpft");
          await finish("/username-required");
          return;
        }
        toast.error(mapAuthError(result.message));
        await finish(data.session ? "/username-required" : "/login");
        return;
      }

      // pending: wait briefly for detectSessionInUrl, then fail closed
      const again = await supabase.auth.getSession();
      if (again.data.session) {
        await finish(OAUTH_SUCCESS_PATH);
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      clearOAuthFlowLock();
      toast.error("Die Anmeldung konnte nicht abgeschlossen werden. Bitte starte den Vorgang erneut.");
      navigate("/login", { replace: true });
    }

    void complete();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return <FullScreenSpinner label="Anmeldung wird abgeschlossen …" />;
}

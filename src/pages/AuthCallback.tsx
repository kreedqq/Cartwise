import * as React from "react";
import { useNavigate } from "react-router-dom";

import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { toast } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabaseClient";
import {
  clearOAuthFlowKind,
  clearOAuthFlowLock,
  completeOAuthCallback,
  logOAuthCallbackDiagnostics,
  mapAuthError,
  OAUTH_SUCCESS_PATH,
  readOAuthFlowKind,
  signOut,
} from "@/services/auth";
import {
  applyTelegramReauthUsername,
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
 * Flow A (login), Flow B (link), and Flow C (transfer) must not share completion logic.
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
      clearOAuthFlowKind();
      toast.error("Die Anmeldung konnte nicht abgeschlossen werden. Bitte starte den Vorgang erneut.");
      navigate("/login", { replace: true });
    }, 12_000);

    async function finish(path: string) {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      clearOAuthFlowLock();
      clearOAuthFlowKind();
      navigate(path, { replace: true });
    }

    async function complete() {
      const href = window.location.href;
      const search = window.location.search;
      const hash = window.location.hash;
      const flowKind = readOAuthFlowKind();
      const transferIntentId = readTelegramTransferIntent();
      logOAuthCallbackDiagnostics({ href, search, hash, phase: "start" });
      console.info("[peptix:oauth]", {
        phase: "callback-context",
        flow: flowKind,
        hasTransferIntent: Boolean(transferIntentId),
      });

      const result = await completeOAuthCallback({
        href,
        search,
        hash,
        getSession: () => supabase.auth.getSession(),
        exchangeCodeForSession: (url) => supabase.auth.exchangeCodeForSession(url),
      });
      if (cancelled) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionUserId = session?.user?.id ?? null;
      const sessionProvider =
        (session?.user?.app_metadata as { provider?: string } | undefined)?.provider ?? null;
      const hasTelegramIdentity = Boolean(
        session?.user?.identities?.some((identity) => identity.provider === "custom:telegram"),
      );

      logOAuthCallbackDiagnostics({
        href,
        search,
        hash,
        phase: "result",
        status: result.status,
        message: result.status === "failed" ? result.message : undefined,
      });
      console.info("[peptix:oauth]", {
        phase: "callback-session",
        flow: flowKind,
        status: result.status,
        hasSession: Boolean(session),
        sessionUserId,
        sessionProvider,
        hasTelegramIdentity,
      });

      if (result.status === "authenticated") {
        // Flow C only: explicit transfer confirmation must have set both markers.
        if (flowKind === "transfer" && transferIntentId) {
          console.info("[peptix:transfer]", {
            phase: "before_complete",
            intentId: transferIntentId,
            targetUserId: null,
            currentSessionUserId: sessionUserId,
            sessionProvider,
            hasTelegramIdentity,
            flowKind,
          });
          try {
            const applied = await completeTelegramIdentityTransfer(transferIntentId);
            console.info("[peptix:transfer]", {
              phase: "complete_ok",
              intentId: transferIntentId,
              currentSessionUserId: sessionUserId,
              telegramUsername: applied,
              result: "ok",
            });
            clearTelegramTransferIntent();
            clearTelegramIdentityConflict();
            if (sessionUserId) clearUsernameChangeEligible(sessionUserId);
            await signOut();
            toast.success("Telegram erfolgreich verknüpft. Bitte melde dich erneut mit E-Mail an.");
            await finish("/login");
          } catch (err) {
            console.info("[peptix:transfer]", {
              phase: "complete_failed",
              intentId: transferIntentId,
              currentSessionUserId: sessionUserId,
              sessionProvider,
              operation: "complete_telegram_identity_transfer",
              result: "error",
              error: mapUsernameError(err).slice(0, 180),
            });
            console.info("[peptix:username]", {
              operation: "complete_telegram_identity_transfer",
              flow: "transfer",
              result: "error",
              error: mapUsernameError(err).slice(0, 180),
            });
            clearTelegramTransferIntent();
            toast.error(mapUsernameError(err));
            await signOut();
            await finish("/login");
          }
          return;
        }

        // Stale transfer intent must never hijack Flow A/B.
        if (transferIntentId) {
          console.info("[peptix:transfer]", {
            phase: "stale_intent_ignored",
            intentId: transferIntentId,
            flowKind,
            currentSessionUserId: sessionUserId,
          });
          clearTelegramTransferIntent();
        }
        if (flowKind === "login") {
          clearTelegramIdentityConflict();
        }

        // Flow B: after linkIdentity, set profiles.username from preferred_username.
        // Never run this on Flow A normal login.
        if (flowKind === "link") {
          try {
            const applied = await applyTelegramReauthUsername();
            console.info("[peptix:username]", {
              operation: "apply_telegram_reauth_username",
              flow: "link",
              reason: "post_link_success",
              targetUserId: sessionUserId,
              telegramUsername: applied,
              result: "ok",
            });
            if (sessionUserId) clearUsernameChangeEligible(sessionUserId);
            clearTelegramIdentityConflict();
            toast.success("Telegram erfolgreich verknüpft.");
            await finish(OAUTH_SUCCESS_PATH);
          } catch (err) {
            const message = mapUsernameError(err);
            console.info("[peptix:username]", {
              operation: "apply_telegram_reauth_username",
              flow: "link",
              reason: "post_link_failed",
              targetUserId: sessionUserId,
              result: "error",
              error: message.slice(0, 180),
              hasTelegramIdentity,
            });
            if (isTelegramIdentityConflictError(err)) {
              markTelegramIdentityConflict();
              toast("Telegram Konto bereits verknüpft");
              await finish("/username-required");
              return;
            }
            toast.error(message);
            // Stay on linking gate — do not send a half-linked session to the dashboard.
            await finish("/username-required");
          }
          return;
        }

        await finish(OAUTH_SUCCESS_PATH);
        return;
      }

      if (result.status === "failed") {
        // Identity-already-linked is only a Flow B (linkIdentity) conflict → Flow C UI.
        if (
          flowKind === "link" &&
          session &&
          isTelegramIdentityConflictError(result.message)
        ) {
          markTelegramIdentityConflict();
          toast("Telegram Konto bereits verknüpft");
          await finish("/username-required");
          return;
        }

        if (flowKind === "login") {
          clearTelegramIdentityConflict();
          clearTelegramTransferIntent();
        }

        toast.error(mapAuthError(result.message));
        await finish(session ? "/username-required" : "/login");
        return;
      }

      // pending: wait briefly for detectSessionInUrl, then fail closed
      const again = await supabase.auth.getSession();
      if (again.data.session) {
        if (transferIntentId && flowKind !== "transfer") {
          clearTelegramTransferIntent();
        }
        await finish(OAUTH_SUCCESS_PATH);
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      clearOAuthFlowLock();
      clearOAuthFlowKind();
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

import * as React from "react";
import { useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { RequireUsernameForm } from "@/components/auth/RequireUsernameDialog";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthProvider";
import { publicUsername } from "@/lib/username";
import {
  mapAuthError,
  POST_LOGIN_PATH,
  signInWithOAuth,
  signOut,
  TELEGRAM_OAUTH_PROVIDER,
} from "@/services/auth";
import {
  applyTelegramReauthUsername,
  clearUsernameChangeEligible,
  isUsernameChangeRequest,
  mapUsernameError,
  shouldPromptForUsername,
} from "@/services/username";

export default function UsernameRequiredPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const needsUsername = shouldPromptForUsername({ loading, user, profile });
  const isReauth = isUsernameChangeRequest(profile);
  const destination = POST_LOGIN_PATH;
  const currentHandle = publicUsername(profile);

  const [reauthError, setReauthError] = React.useState<string | null>(null);
  const [reauthBusy, setReauthBusy] = React.useState(false);
  const [telegramBusy, setTelegramBusy] = React.useState(false);
  const applyAttempted = React.useRef(false);

  React.useEffect(() => {
    if (loading) return;
    if (!needsUsername) {
      navigate(destination, { replace: true });
    }
  }, [loading, needsUsername, destination, navigate]);

  React.useEffect(() => {
    if (!isReauth || !needsUsername || loading || applyAttempted.current) return;
    // Only auto-apply when this session is already Telegram OIDC. Email/Discord
    // sessions stay on the CTA; the server also rejects non-Telegram JWTs.
    if (user?.app_metadata?.provider !== TELEGRAM_OAUTH_PROVIDER) return;
    applyAttempted.current = true;
    let cancelled = false;

    async function tryApply() {
      setReauthBusy(true);
      setReauthError(null);
      try {
        await applyTelegramReauthUsername();
        if (user?.id) clearUsernameChangeEligible(user.id);
        await refreshProfile();
        if (!cancelled) navigate(destination, { replace: true });
      } catch (err) {
        if (!cancelled) setReauthError(mapUsernameError(err));
      } finally {
        if (!cancelled) setReauthBusy(false);
      }
    }

    void tryApply();
    return () => {
      cancelled = true;
    };
  }, [isReauth, needsUsername, loading, user?.id, user?.app_metadata?.provider, refreshProfile, navigate, destination]);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  async function handleTelegramReauth() {
    setTelegramBusy(true);
    setReauthError(null);
    try {
      // End any Email/Discord session so the next auth is a real Telegram OIDC login
      // for this browser — then apply_telegram_reauth_username can consume the flag.
      await signOut();
      await signInWithOAuth(TELEGRAM_OAUTH_PROVIDER);
    } catch (error) {
      setReauthError(mapAuthError(error));
      setTelegramBusy(false);
    }
  }

  if (loading || !needsUsername) return <FullScreenSpinner />;

  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col gap-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">PEPTIX</p>
          {isReauth ? (
            <>
              <h1 className="text-lg font-semibold">Telegram Anmeldung erforderlich</h1>
              <p className="text-sm text-muted-foreground">
                Bitte melde dich mit Telegram an, damit dein Telegram Benutzername automatisch aktualisiert werden
                kann.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Telegram Benutzername erforderlich</h1>
              <p className="text-sm text-muted-foreground">
                Bitte trage deinen Telegram Benutzernamen ein bzw. bestätige ihn, bevor du PEPTIX weiter nutzen kannst.
              </p>
            </>
          )}
        </div>

        {isReauth ? (
          <div className="space-y-3">
            {currentHandle ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Aktueller Benutzername</p>
                <p className="font-medium">@{currentHandle}</p>
              </div>
            ) : null}
            {reauthBusy ? (
              <p className="text-sm text-muted-foreground">Telegram Benutzername wird übernommen …</p>
            ) : null}
            {reauthError ? <p className="text-xs text-destructive">{reauthError}</p> : null}
            <Button
              type="button"
              className="w-full"
              loading={telegramBusy}
              disabled={reauthBusy}
              onClick={() => void handleTelegramReauth()}
            >
              Mit Telegram anmelden
            </Button>
            <p className="text-xs text-muted-foreground">
              Nach erfolgreicher Telegram Anmeldung wird dein verifizierter Telegram Benutzername übernommen und
              anschließend wieder gesperrt. E-Mail oder Discord können diesen Schritt nicht ersetzen.
            </p>
          </div>
        ) : (
          <RequireUsernameForm onSaved={() => navigate(destination, { replace: true })} />
        )}

        <Button type="button" variant="ghost" className="w-full" onClick={() => void handleSignOut()}>
          Abmelden
        </Button>
      </div>
    </AuthLayout>
  );
}

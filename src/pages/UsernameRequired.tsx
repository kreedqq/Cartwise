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
  startTelegramAccountLink,
  TELEGRAM_OAUTH_PROVIDER,
} from "@/services/auth";
import {
  clearTelegramIdentityConflict,
  clearTelegramTransferIntent,
  createTelegramTransferIntent,
  hasTelegramIdentityConflict,
  isUsernameChangeRequest,
  mapUsernameError,
  shouldPromptForUsername,
  storeTelegramTransferIntent,
} from "@/services/username";

/**
 * Username / Telegram-linking duty page.
 * Normal Telegram login of an already-linked account must never land here just because
 * preferred_username differs from profiles.username — see shouldPromptForUsername.
 */
export default function UsernameRequiredPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const needsUsername = shouldPromptForUsername({ loading, user, profile });
  const isReauth = isUsernameChangeRequest(profile);
  const destination = POST_LOGIN_PATH;
  const currentHandle = publicUsername(profile);

  const [reauthError, setReauthError] = React.useState<string | null>(null);
  const [telegramBusy, setTelegramBusy] = React.useState(false);
  const [transferBusy, setTransferBusy] = React.useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = React.useState(() => hasTelegramIdentityConflict());

  React.useEffect(() => {
    if (loading) return;
    if (!needsUsername) {
      navigate(destination, { replace: true });
    }
  }, [loading, needsUsername, destination, navigate]);

  async function handleSignOut() {
    clearTelegramIdentityConflict();
    clearTelegramTransferIntent();
    await signOut();
    navigate("/login", { replace: true });
  }

  async function handleTelegramLink() {
    setTelegramBusy(true);
    setReauthError(null);
    try {
      // Keep the existing PEPTIX session. linkIdentity attaches Telegram to this
      // auth.users.id. Never signOut first — that would allow a duplicate account.
      // Username apply runs in AuthCallback only for flowKind === "link".
      await startTelegramAccountLink(user);
    } catch (error) {
      setReauthError(mapAuthError(error));
      setTelegramBusy(false);
    }
  }

  async function handleConfirmTransfer() {
    setTransferBusy(true);
    setReauthError(null);
    try {
      const intentId = await createTelegramTransferIntent();
      storeTelegramTransferIntent(intentId);
      clearTelegramIdentityConflict();
      // Prove ownership of the Telegram account (session becomes the source user).
      // complete_telegram_identity_transfer then moves the identity onto the target.
      await signInWithOAuth(TELEGRAM_OAUTH_PROVIDER, undefined, { flow: "transfer" });
    } catch (error) {
      setReauthError(mapUsernameError(error));
      setTransferBusy(false);
    }
  }

  function handleCancelTransfer() {
    clearTelegramIdentityConflict();
    clearTelegramTransferIntent();
    setShowTransferConfirm(false);
    setReauthError(null);
  }

  if (loading || !needsUsername) return <FullScreenSpinner />;

  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col gap-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">PEPTIX</p>
          {isReauth ? (
            showTransferConfirm ? (
              <>
                <h1 className="text-lg font-semibold">Telegram Konto bereits verknüpft</h1>
                <p className="text-sm text-muted-foreground">
                  Dieses Telegram Konto ist bereits mit einem anderen PEPTIX Konto verbunden. Möchtest du die Telegram
                  Verknüpfung auf dieses PEPTIX Konto übertragen?
                </p>
              </>
            ) : (
              <>
                <h1 className="text-lg font-semibold">Telegram Anmeldung erforderlich</h1>
                <p className="text-sm text-muted-foreground">
                  Bitte melde dich mit Telegram an. Dein bestehender PEPTIX Account wird anschließend mit deinem
                  Telegram Konto verknüpft.
                </p>
              </>
            )
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
            {reauthError ? <p className="text-xs text-destructive">{reauthError}</p> : null}

            {showTransferConfirm ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Dabei wird die bisherige Telegram Verknüpfung vom anderen PEPTIX Konto entfernt. Dein Telegram Konto
                  und deine Telegram Daten werden nicht gelöscht.
                </p>
                <Button
                  type="button"
                  className="w-full"
                  loading={transferBusy}
                  onClick={() => void handleConfirmTransfer()}
                >
                  Telegram neu zuweisen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={transferBusy}
                  onClick={handleCancelTransfer}
                >
                  Abbrechen
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  className="w-full"
                  loading={telegramBusy}
                  onClick={() => void handleTelegramLink()}
                >
                  Mit Telegram anmelden
                </Button>
                <p className="text-xs text-muted-foreground">
                  Nach erfolgreicher Verknüpfung wird dein verifizierter Telegram Benutzername automatisch übernommen
                  und gesperrt. Es entsteht kein zweites PEPTIX Konto. E-Mail oder Discord können diesen Schritt nicht
                  ersetzen.
                </p>
              </>
            )}
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

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthProvider";
import { usernameSchema } from "@/lib/validation";
import { claimUsername, mapUsernameError } from "@/services/username";

/**
 * Transition mechanism for pre-existing users (Discord or email) who signed
 * up before the username system existed: prompted once, on any authenticated
 * page, until they claim a unique public handle. Never blocks logged-out
 * pages, never shows real name/email as a fallback identity.
 */
export function RequireUsernameDialog() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const open = Boolean(!loading && user && profile && !profile.username);

  // Discord (or any OAuth provider) may suggest a handle — pre-filled only,
  // never auto-saved, and always sanitized to the allowed username charset.
  React.useEffect(() => {
    if (!open || value) return;
    const suggestionRaw =
      (user?.user_metadata?.user_name as string | undefined) ??
      (user?.user_metadata?.username as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined) ??
      "";
    const sanitized = suggestionRaw.replace(/[^A-Za-z0-9_.]/g, "").slice(0, 24);
    if (sanitized.length >= 3 && /^[A-Za-z]/.test(sanitized)) {
      queueMicrotask(() => setValue(sanitized));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = usernameSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Ungültiger Benutzername.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await claimUsername(result.data);
      await refreshProfile();
    } catch (err) {
      setError(mapUsernameError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Wähle deinen Benutzernamen</DialogTitle>
          <DialogDescription>
            Dieser Name wird beim Kit Sharing anderen Nutzern angezeigt — niemals deine E-Mail-Adresse oder dein
            echter Name.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="require-username">Benutzername</Label>
            <Input
              id="require-username"
              autoComplete="username"
              placeholder="ExampleUser"
              value={value}
              invalid={!!error}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">3–24 Zeichen, beginnend mit einem Buchstaben.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" loading={busy}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

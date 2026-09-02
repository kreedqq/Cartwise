import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthProvider";
import { usernameSchema } from "@/lib/validation";
import { claimUsername, mapUsernameError, shouldPromptForUsername } from "@/services/username";

/**
 * Telegram handle form used after login when username is missing or an admin
 * required confirmation. Prefills OAuth `preferred_username` / `user_name` /
 * `username` — never auto-saved, never email.
 */
export function RequireUsernameForm({ onSaved }: { onSaved?: () => void }) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const open = shouldPromptForUsername({ loading, user, profile });

  React.useEffect(() => {
    if (!open || value) return;
    const existing = profile?.username?.trim() ?? "";
    const suggestionRaw =
      existing ||
      (user?.user_metadata?.preferred_username as string | undefined) ||
      (user?.user_metadata?.user_name as string | undefined) ||
      (user?.user_metadata?.username as string | undefined) ||
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
      setError(result.error.issues[0]?.message ?? "Ungültiger Telegram Benutzername.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await claimUsername(result.data);
      await refreshProfile();
      onSaved?.();
    } catch (err) {
      setError(mapUsernameError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="require-username">Telegram Benutzername</Label>
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
      <Button type="submit" className="w-full" loading={busy}>
        Speichern
      </Button>
    </form>
  );
}

/** Kept so existing tests can still read this module for claimUsername / preferred_username. */
export function RequireUsernameDialog() {
  return <RequireUsernameForm />;
}

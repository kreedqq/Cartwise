import * as React from "react";
import { Save, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/context/AuthProvider";
import { usernameSchema } from "@/lib/validation";
import { claimUsername, mapUsernameError } from "@/services/username";
import { formatDateTime } from "@/lib/money";
import { PageHeader } from "@/components/common/PageHeader";

export default function ProfilePage() {
  const { user, profile, roles, customerRoleName, refreshProfile } = useAuth();
  const [username, setUsername] = React.useState(profile?.username ?? "");
  const [usernameError, setUsernameError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setUsername(profile?.username ?? "");
  }, [profile?.username]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setUsernameError(null);

    const usernameResult = usernameSchema.safeParse(username);
    if (!usernameResult.success) {
      setUsernameError(usernameResult.error.issues[0]?.message ?? "Ungültiger Telegram Benutzername.");
      return;
    }

    setSaving(true);
    try {
      if (usernameResult.data !== (profile?.username ?? "")) {
        await claimUsername(usernameResult.data);
        await refreshProfile();
      }
      toast.success("Profil gespeichert.");
    } catch (error) {
      console.error("Profil speichern fehlgeschlagen:", error);
      toast.error(mapUsernameError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Konto"
        title="Profil"
        description="Telegram Benutzername, Rolle und Kontodaten. Du siehst nur deine eigene Rolle."
      />

      <Card>
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle>Persönliche Angaben</CardTitle>
            <CardDescription>
              Der Telegram Benutzername ist die einzige öffentliche Identität. Warenkörbe folgen automatisch diesem
              Namen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Telegram Benutzername</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                invalid={!!usernameError}
                onChange={(e) => setUsername(e.target.value)}
              />
              {usernameError ? (
                <p className="text-xs text-destructive">{usernameError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Dieser Name gilt überall: Profil, Warenkörbe, Kit Sharing und Kit Gesuche.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Meine Rolle</Label>
              <p className="text-sm font-medium">{customerRoleName ?? "—"}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Kontozugriff</Label>
              <div className="flex gap-2">
                {roles.map((role) => (
                  <Badge key={role} variant={role === "admin" ? "success" : "secondary"}>
                    {role === "admin" && <ShieldCheck className="h-3 w-3" />}
                    {role === "admin" ? "Admin" : "Nutzer"}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="justify-end">
            <Button type="submit" loading={saving}>
              <Save /> Speichern
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Konto erstellt: {formatDateTime(profile?.created_at)}</p>
          <p>Nutzer-ID: <span className="font-mono text-xs">{user?.id}</span></p>
        </CardContent>
      </Card>
    </div>
  );
}

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
import { profileSchema } from "@/lib/validation";
import { updateDisplayName } from "@/services/profiles";
import { formatDateTime } from "@/lib/money";
import { PageHeader } from "@/components/common/PageHeader";
import { visibleAccountLabel } from "@/lib/username";

export default function ProfilePage() {
  const { user, profile, roles, customerRoleName, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = React.useState(profile?.display_name ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Syncs the editable field once the profile finishes loading from the
  // server (React's own docs endorse "adjust state when a prop changes").
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const result = profileSchema.safeParse({ displayName });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    setError(null);
    if (!user) return;
    setSaving(true);
    try {
      await updateDisplayName(user.id, result.data.displayName);
      await refreshProfile();
      toast.success("Profil gespeichert.");
    } catch (error) {
      console.error("Profil speichern fehlgeschlagen:", error);
      toast.error("Profil konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Konto"
        title="Profil"
        description="Anzeigename, Rolle und Kontodaten. Du siehst nur deine eigene Rolle."
      />

      <Card>
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle>Persönliche Angaben</CardTitle>
            <CardDescription>
              Dein Benutzername ist die öffentliche Identität. Der Anzeigename bleibt nur für dich.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Benutzername</Label>
              <Input id="username" value={visibleAccountLabel(profile)} disabled />
              <p className="text-xs text-muted-foreground">
                Dieser Name gilt überall: Profil, Warenkörbe und Kit Sharing. Er wird bei der Registrierung festgelegt.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Anzeigename</Label>
              <Input
                id="displayName"
                value={displayName}
                invalid={!!error}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
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

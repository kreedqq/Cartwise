import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthProvider";
import { formatDateTime } from "@/lib/money";
import { PageHeader } from "@/components/common/PageHeader";
import { publicUsername } from "@/lib/username";

export default function ProfilePage() {
  const { user, profile, roles, customerRoleName } = useAuth();
  const username = publicUsername(profile);
  const hasUsername = Boolean(username);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Konto"
        title="Profil"
        description="Telegram Benutzername, Rolle und Kontodaten. Du siehst nur deine eigene Rolle."
      />

      <Card>
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
            <Label>Telegram Benutzername</Label>
            {hasUsername ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold tracking-tight">@{username}</p>
                  <Badge variant="success">✓ Bestätigt</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dein Telegram Benutzername kann nicht selbst geändert werden.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch nicht gesetzt. Du wirst beim nächsten Schritt zur Eingabe aufgefordert.
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Konto erstellt: {formatDateTime(profile?.created_at)}</p>
          <p>
            Nutzer-ID: <span className="font-mono text-xs">{user?.id}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

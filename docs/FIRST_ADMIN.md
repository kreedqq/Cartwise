# Ersten Admin anlegen

Es gibt bewusst **keine** Self-Service-Möglichkeit, sich selbst zum Admin zu
machen (siehe `docs/SECURITY.md`). Der erste Admin wird einmalig vom
Projektinhaber per SQL angelegt.

## Schritte

1. Registriere dich normal über die App-Oberfläche (`/register`) mit der
   E-Mail-Adresse, die Admin-Rechte erhalten soll.
2. Bestätige ggf. deine E-Mail-Adresse (falls im Supabase-Projekt aktiviert).
3. Öffne im Supabase-Dashboard **SQL Editor** deines Projekts.
4. Finde deine `user_id`:

   ```sql
   select id, email from auth.users where email = 'deine-admin-adresse@example.com';
   ```

5. Vergib die Admin-Rolle:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('<UUID-AUS-SCHRITT-4>', 'admin')
   on conflict (user_id, role) do nothing;
   ```

6. Melde dich in der App ab und wieder an (oder lade die Seite neu), damit der
   neue Rollenstand geladen wird. Der Admin-Bereich (`/admin`) ist jetzt
   sichtbar.

## Weitere Admins anlegen

Sobald mindestens ein Admin existiert, kannst du **weitere** Admins bequem im
Admin-Bereich unter **Benutzer & Rollen** ernennen — dort ruft die App die
Edge Function `set-user-role` auf, die serverseitig prüft, dass der
aufrufende Nutzer selbst Admin ist. Ein erneuter manueller SQL-Befehl ist
danach nicht mehr nötig.

## Admin-Rechte entziehen

Im Admin-Bereich unter **Benutzerübersicht** kann eine Admin-Rolle wieder
entzogen werden. Ein Nutzer kann sich dort nicht selbst die eigene
Admin-Rolle entziehen (verhindert versehentliches Aussperren aller Admins).

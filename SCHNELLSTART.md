# Cartwise in wenigen Minuten veröffentlichen

## 1. Lokal testen

In diesem Ordner eine Eingabeaufforderung öffnen und ausführen:

```cmd
npm ci
npm run dev
```

Dann `http://localhost:5173/` öffnen. Die lokale `.env.local` ist bereits
konfiguriert und wird nicht zu GitHub hochgeladen.

## 2. GitHub-Repository anlegen und hochladen

Auf GitHub ein neues **leeres** Repository `cartwise` anlegen. Danach hier
ausführen (GitHub-Namen ersetzen):

```cmd
git init
git add .
git commit -m "Initial Cartwise deployment"
git branch -M main
git remote add origin https://github.com/DEIN-GITHUB-NAME/cartwise.git
git push -u origin main
```

In GitHub: **Settings → Pages → Source: GitHub Actions**.

Unter **Settings → Secrets and variables → Actions** diese Repository-Secrets
anlegen:

| Name | Wert |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://cnjrjinvxycdkrmzcime.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Dein Supabase Publishable key |

Beide Werte **nackt** eintragen — ohne Anführungszeichen, ohne Zeilenumbruch und
ohne Markdown-Klammern. Ein aus einem gerenderten Dokument kopiertes
`[https://…](https://…)` ist der häufigste Grund für `ERR_NAME_NOT_RESOLVED`
im Browser.

Nach dem Push veröffentlicht GitHub Actions die App unter
`https://DEIN-GITHUB-NAME.github.io/cartwise/`.

## 3. Supabase-Datenbank einrichten

Installiere die Supabase CLI und spiele die Migrationen ein:

```cmd
npm install -g supabase
supabase login
supabase link --project-ref cnjrjinvxycdkrmzcime
supabase db push
supabase functions deploy get-exchange-rate
supabase functions deploy set-user-role
```

In Supabase unter **Authentication → URL Configuration** eintragen:

```text
Site URL: https://peptix.app
https://peptix.app/**
https://www.peptix.app/**
http://localhost:5173/**
```

Discord Redirect URI (Developer Portal, nicht Peptix):

```text
https://cnjrjinvxycdkrmzcime.supabase.co/auth/v1/callback
```

## 4. Ersten Admin anlegen

Zuerst in der App registrieren. Anschließend im Supabase SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'DEINE-E-MAIL-ADRESSE';
```

Danach ab- und wieder anmelden.

## Wichtig

Den Publishable Key darf das Frontend verwenden. Einen **Secret Key** oder
`service_role` Key niemals in GitHub-Secrets für den Frontend-Build, `.env.local`
oder den Browser eintragen.

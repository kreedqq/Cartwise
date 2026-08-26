# Gemeinsame Warenkörbe & Bestelllisten

Eine produktionsreife Web-App für Teams, um gemeinsam Warenkörbe/Bestelllisten
zu pflegen: zentrale Produktdatenbank, Excel-artige Positionstabelle mit
automatischer Artikelauflösung, Live-Summen in USD/EUR mit transparentem
Wechselkurs, PDF-Import von Produktlisten mit Vorschau/Validierung und ein
Admin-Bereich für Produkte, Preise, Rollen und Audit-Log.

Frontend: React + TypeScript + Vite, gehostet auf GitHub Pages.
Backend: Supabase (Postgres + Row Level Security, Auth, Storage, Edge
Functions). GitHub Pages liefert **ausschließlich statische Dateien** — jede
sicherheitsrelevante Logik läuft serverseitig in Supabase (RLS-Policies,
Postgres-Funktionen, Edge Functions).

Alle fachlichen/technischen Entscheidungen und Annahmen sind in
[`docs/KONZEPT.md`](docs/KONZEPT.md) begründet dokumentiert. Diese README
konzentriert sich auf **Setup, Konfiguration und Deployment**.

## Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Lokales Setup](#lokales-setup)
3. [Supabase-Projekt einrichten](#supabase-projekt-einrichten)
4. [Ersten Admin anlegen](#ersten-admin-anlegen)
5. [Wechselkurs-Konfiguration](#wechselkurs-konfiguration)
6. [Umgebungsvariablen & Secrets](#umgebungsvariablen--secrets)
7. [GitHub Actions & Deployment auf GitHub Pages](#github-actions--deployment-auf-github-pages)
8. [Supabase Auth Redirect-URLs](#supabase-auth-redirect-urls)
9. [Tests, Typprüfung, Linting](#tests-typprüfung-linting)
10. [Projektstruktur](#projektstruktur)
11. [Weiterführende Dokumentation](#weiterführende-dokumentation)
12. [Produktions-Checkliste](#produktions-checkliste)
13. [Abschluss-Checkliste: Anforderungen ↔ Umsetzung](#abschluss-checkliste-anforderungen--umsetzung)

## Voraussetzungen

- Node.js 22+ und npm
- Ein kostenloses [Supabase](https://supabase.com)-Konto (für Auth, Postgres,
  Storage, Edge Functions)
- Die [Supabase CLI](https://supabase.com/docs/guides/cli) für Migrationen
  und lokale Entwicklung (`npm install -g supabase` oder per Paketmanager)
- Ein GitHub-Repository, falls über GitHub Pages deployed werden soll

## Lokales Setup

```bash
npm install
cp .env.example .env.local
# .env.local mit den Werten aus deinem Supabase-Projekt befüllen (siehe unten)
npm run dev
```

Die App läuft dann unter `http://localhost:5173`.

`.env.local` ist in `.gitignore` und wird nie committed. `.env.example`
enthält nur Platzhalter und keine echten Schlüssel.

## Supabase-Projekt einrichten

1. Neues Projekt auf [supabase.com](https://supabase.com/dashboard) anlegen.
2. Projekt-URL und `anon`-Key kopieren: **Project Settings → API**. Beide
   Werte sind bewusst öffentlich (siehe [Umgebungsvariablen & Secrets](#umgebungsvariablen--secrets))
   und kommen in `.env.local` (lokal) bzw. GitHub Secrets (Deployment).
3. Mit der Supabase CLI verbinden und die Migrationen anwenden:

   ```bash
   supabase login
   supabase link --project-ref <dein-project-ref>
   supabase db push
   ```

   Das führt alle SQL-Dateien unter [`supabase/migrations/`](supabase/migrations)
   in aufsteigender Reihenfolge aus (0001 → 0013) und legt damit das komplette
   Schema an: `profiles`, `user_roles`, `products`, `product_price_history`,
   `carts`, `cart_items`, `exchange_rates`, `pdf_imports`, `pdf_import_rows`,
   `audit_logs`, alle RLS-Policies, Hilfsfunktionen (`has_role`, …), RPCs
   (`apply_pdf_import`, `duplicate_cart`, `set_active_cart`, …) und den
   Storage-Bucket für PDF-Uploads samt Policies. Details je Tabelle in
   [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), alle Policies in
   [`docs/SECURITY.md`](docs/SECURITY.md).

4. Optional: Beispieldaten einspielen (nur für Entwicklung, nie in Produktion
   nötig):

   ```bash
   supabase db execute -f supabase/seed.sql
   ```

5. Edge Functions deployen:

   ```bash
   supabase functions deploy get-exchange-rate
   supabase functions deploy set-user-role
   ```

   `get-exchange-rate` ruft serverseitig den USD/EUR-Kurs ab (siehe
   [Wechselkurs-Konfiguration](#wechselkurs-konfiguration)), `set-user-role`
   ist der einzige Weg, um nach dem initialen Bootstrap weitere
   Admin-Rechte zu vergeben/entziehen (server-seitig geprüft, siehe
   [`docs/SECURITY.md`](docs/SECURITY.md)).

6. E-Mail-Bestätigung (optional): Falls dein Projekt Pflicht-E-Mail-Verifizierung
   nutzen soll, unter **Authentication → Providers → Email** *"Confirm email"*
   aktivieren. Die App unterstützt beide Modi transparent (unbestätigte Nutzer
   sehen einen entsprechenden Hinweis nach der Registrierung).

## Ersten Admin anlegen

Es gibt bewusst **keine** Self-Service-Möglichkeit, sich selbst Admin-Rechte zu
geben. Der erste Admin wird einmalig per SQL angelegt — die vollständige
Schritt-für-Schritt-Anleitung steht in
[`docs/FIRST_ADMIN.md`](docs/FIRST_ADMIN.md). Kurzfassung:

1. In der App unter `/register` registrieren.
2. Im Supabase SQL Editor die eigene `user_id` per E-Mail nachschlagen.
3. `insert into public.user_roles (user_id, role) values ('<uuid>', 'admin');`
4. Neu einloggen — der Admin-Bereich (`/admin`) ist danach sichtbar.

Weitere Admins werden anschließend bequem über den Admin-Bereich
(**Benutzerübersicht**) ernannt/entzogen, ohne erneuten SQL-Zugriff.

## Wechselkurs-Konfiguration

Es ist **kein API-Key nötig**: Die Edge Function `get-exchange-rate` bezieht
den USD/EUR-Kurs von der kostenlosen, schlüssellosen
[Frankfurter API](https://frankfurter.dev) (Referenzkurse der Europäischen
Zentralbank). Der Kurs wird serverseitig in der Tabelle `exchange_rates`
zwischengespeichert; Details zur Cache-/Fallback-Logik stehen im Kommentarkopf
von [`supabase/functions/get-exchange-rate/index.ts`](supabase/functions/get-exchange-rate/index.ts)
und in `docs/KONZEPT.md` §6.

Ein optionales Secret steuert die Cache-Dauer:

```bash
supabase secrets set EXCHANGE_RATE_CACHE_MINUTES=60
```

(Standard: 60 Minuten, falls nicht gesetzt.) Ein zweites optionales Secret
schränkt CORS auf bekannte Frontend-Origins ein (siehe nächster Abschnitt).

Falls später ein schlüsselbasierter Anbieter gewünscht ist, muss der Schlüssel
**ausschließlich** als Supabase Edge Function Secret gesetzt werden — niemals
als `VITE_*`-Variable, da alles mit `VITE_`-Präfix im Frontend-Bundle landet
und öffentlich einsehbar wäre.

## Umgebungsvariablen & Secrets

Es gibt zwei getrennte Welten. Nicht vermischen:

| Wert | Wo er hingehört | Warum |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` (lokal) **und** GitHub Secrets (Deployment) | Öffentliche Projekt-URL, landet im Frontend-Bundle. Unkritisch, da alle Rechte über RLS laufen. |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` **und** GitHub Secrets | Der `anon`-Key ist bewusst öffentlich (Supabase-Design) — er kann *nur* das, was RLS erlaubt. Landet ebenfalls im Bundle. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nur** `supabase secrets set` (Edge Function Secret) | Umgeht RLS vollständig. Darf **niemals** in `.env.local`, niemals als GitHub Secret für den Frontend-Build, niemals im Client-Code auftauchen. |
| `EXCHANGE_RATE_CACHE_MINUTES` | `supabase secrets set` | Reine Server-Konfiguration, betrifft nur die Edge Function. |
| `ALLOWED_ORIGINS` | `supabase secrets set` | Kommagetrennte Liste erlaubter Frontend-Origins für CORS in den Edge Functions, z. B. `https://dein-name.github.io`. |

Edge-Function-Secrets setzen:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... # wird von Supabase i.d.R. automatisch bereitgestellt
supabase secrets set ALLOWED_ORIGINS=https://<dein-github-name>.github.io
```

GitHub Secrets setzen: Repository → **Settings → Secrets and variables →
Actions → New repository secret** → `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY` anlegen. Diese werden ausschließlich vom Workflow
[`​.github/workflows/deploy.yml`](.github/workflows/deploy.yml) beim Bauen des
statischen Bundles verwendet.

**Merksatz:** Alles mit `VITE_`-Präfix ist öffentlich und gehört ins Frontend
(`.env.local` / GitHub Secrets). Alles andere (Service-Role-Key,
Wechselkurs-Cache-Dauer, CORS-Origins) ist Server-Konfiguration und gehört
ausschließlich in `supabase secrets`.

## GitHub Actions & Deployment auf GitHub Pages

Der Workflow [`​.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
läuft bei jedem Push auf `main`:

1. Abhängigkeiten installieren (`npm ci`)
2. Typprüfung (`npm run typecheck`)
3. Linting (`npm run lint`)
4. Tests (`npm test -- --run`)
5. Produktions-Build mit korrektem Pages-Basispfad
6. Veröffentlichung über die offiziellen `actions/deploy-pages`-Actions

Schlägt einer der Schritte 2–4 fehl, wird **nicht** deployed.

### Einmalige Einrichtung

1. Repository-Settings → **Pages** → *Source* auf **GitHub Actions** stellen.
2. Die beiden GitHub Secrets `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`
   anlegen (siehe oben).
3. Push auf `main` — der Workflow deployed automatisch nach
   `https://<dein-github-name>.github.io/<repo-name>/`.

### Vite-Basispfad für Projekt-Repos

GitHub-Pages-Projektseiten werden unter `/<repo-name>/` statt `/` ausgeliefert.
Der Workflow setzt dafür automatisch:

```yaml
env:
  VITE_BASE_PATH: /${{ github.event.repository.name }}/
```

`vite.config.ts` liest diese Variable (Standard `/` für lokale Entwicklung).
Zusätzlich ersetzt der Workflow den Platzhalter `__BASE_PATH__` in
`public/404.html` durch denselben Pfad — das ist der Standard-Kniff für
clientseitiges Routing auf GitHub Pages (kein Server-Rewrite verfügbar: ein
Deep-Link wie `/repo-name/carts/123` landet zunächst auf `404.html`, das zur
App-Basis-URL umleitet; `index.html` stellt den ursprünglichen Pfad danach per
`history.replaceState` wieder her).

Wird die App stattdessen auf einer **Custom Domain** oder als **User/Org-Page**
(`<name>.github.io` ohne Unterpfad) gehostet, muss `VITE_BASE_PATH` im
Workflow auf `/` geändert werden.

## Supabase Auth Redirect-URLs

Supabase muss wissen, wohin es nach Login/Registrierung/Passwort-Reset/
Magic-Link umleiten darf. Unter **Authentication → URL Configuration**:

- **Site URL**: die Produktions-URL, z. B.
  `https://<dein-github-name>.github.io/<repo-name>/`
- **Redirect URLs** (zusätzlich erlauben):
  - `http://localhost:5173` (lokale Entwicklung)
  - `http://localhost:5173/*`
  - `https://<dein-github-name>.github.io/<repo-name>/*` (Produktion)

Ohne diese Einträge schlagen Passwort-Reset- und Magic-Link-E-Mails mit einem
Redirect-Fehler fehl.

## Tests, Typprüfung, Linting

```bash
npm run typecheck   # tsc --noEmit, strikt
npm run lint        # ESLint (Flat Config), 0 Fehler erwartet
npm run lint:fast   # oxlint als schneller Zweit-Linter
npm test            # Vitest: Unit-/Komponententests (57 Tests)
npm run test:coverage
npm run build        # tsc -b && vite build
```

Was die Tests abdecken (Details in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)):
Preisberechnung/Rundung, USD/EUR-Umrechnung, Summenbildung,
Artikelcode-/Mengen-Validierung, Preis-Snapshot-Verhalten, Paste-Import-Parsing,
PDF-Zeilenerkennung, Fehlerklassifizierung, sowie ein Komponententest für den
Bestätigungsdialog. RLS-/Rollen-Szenarien sind zusätzlich als ausführbare
SQL-Testfälle in [`supabase/tests/rls_test_scenarios.sql`](supabase/tests/rls_test_scenarios.sql)
dokumentiert. Der manuelle Abnahme-Testplan für kritische UI-Abläufe steht in
[`docs/MANUAL_QA_CHECKLIST.md`](docs/MANUAL_QA_CHECKLIST.md).

## Projektstruktur

```
src/
  components/       UI-Komponenten (ui/ = Basisbausteine, cart/, admin/, layout/, common/)
  context/          AuthProvider (Session, Profil, Rollen)
  hooks/            Datenzugriff & Business-Logik als Hooks (React Query)
  lib/              Zentrale Logik: money.ts (Rundung/Formatierung), validation.ts,
                     errors.ts, snapshot.ts, constants.ts, supabaseClient.ts
  pdf/              PDF.js-Textextraktion & Zeilenerkennung
  pages/            Routen-Komponenten, inkl. pages/admin/
  routes/           ProtectedRoute / AdminRoute
  services/         Supabase-Datenzugriffsschicht (ein Modul je Entität)
  tests/            Vitest-Setup & Testdateien
  types/database.ts Handgepflegter Supabase-Schema-Typ
supabase/
  migrations/       Vollständiges SQL-Schema (0001–0013, sequenziell anwendbar)
  functions/        Edge Functions (get-exchange-rate, set-user-role, _shared/)
  tests/            SQL-Testszenarien für RLS/Rollen
  seed.sql          Optionale Demo-Daten (nicht Teil der Migrationskette)
docs/               Konzept, Datenmodell, Sicherheit, Risiken, Testplan, Erst-Admin
.github/workflows/  CI/CD (Build, Test, Deploy auf GitHub Pages)
```

## Weiterführende Dokumentation

- [`docs/KONZEPT.md`](docs/KONZEPT.md) — Annahmen, Architektur, Preis-Snapshot-
  und Wechselkurs-Strategie, Risikoübersicht
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — vollständige Feldreferenz aller
  Tabellen
- [`docs/SECURITY.md`](docs/SECURITY.md) — RLS-Policy-Matrix, Storage-Policies,
  Schutz gegen IDOR/Rechteausweitung/Race-Conditions/Upload-Missbrauch
- [`docs/RISKS.md`](docs/RISKS.md) — bekannte Risiken sowie bewusst **nicht**
  umgesetzte Punkte mit Begründung (u. a. OCR, i18n, Tabellen-Virtualisierung)
- [`docs/FIRST_ADMIN.md`](docs/FIRST_ADMIN.md) — Erst-Admin-Bootstrap im Detail
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — Testkonzept
- [`docs/MANUAL_QA_CHECKLIST.md`](docs/MANUAL_QA_CHECKLIST.md) — manuelle
  Abnahme-Checkliste für kritische Abläufe

## Produktions-Checkliste

Vor dem produktiven Go-Live prüfen:

- [ ] Migrationen `0001`–`0013` auf dem produktiven Supabase-Projekt angewendet (`supabase db push`)
- [ ] Beide Edge Functions deployed (`get-exchange-rate`, `set-user-role`)
- [ ] `ALLOWED_ORIGINS`-Secret auf die produktive Pages-URL gesetzt
- [ ] Auth-Redirect-URLs (Site URL + Redirect URLs) auf die produktive URL eingetragen
- [ ] E-Mail-Bestätigung bewusst an/aus geschaltet (siehe oben)
- [ ] GitHub Secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` gesetzt
- [ ] Erster Admin gemäß `docs/FIRST_ADMIN.md` angelegt
- [ ] `npm run build` lokal einmal mit `VITE_BASE_PATH` erfolgreich getestet
- [ ] Storage-Bucket-Policies geprüft (nur Admins lesen/schreiben PDFs, siehe `docs/SECURITY.md`)
- [ ] Kein Service-Role-Key in `.env.local`, GitHub Secrets oder `src/` vorhanden (`grep -r SERVICE_ROLE src/` liefert nichts)
- [ ] `npm run typecheck && npm run lint && npm test -- --run && npm run build` liefert keinen Fehler

## Abschluss-Checkliste: Anforderungen ↔ Umsetzung

Diese Tabelle bestätigt für jede Anforderung aus der ursprünglichen
Spezifikation, wo/wie sie umgesetzt ist.

| Bereich | Anforderung | Umgesetzt in |
|---|---|---|
| Auth | E-Mail/Passwort-Registrierung, Login, Passwort-Reset, optionale E-Mail-Verifizierung, sichere Sessions, Logout, Profil mit Anzeigename, optionaler Magic Link | `src/pages/Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `Profile.tsx`, `src/context/AuthProvider.tsx`, `src/services/auth.ts` |
| Rollen | `user`/`admin` in eigener Tabelle, serverseitig via RLS erzwungen, nicht nur im Frontend | `supabase/migrations/0002_profiles_and_roles.sql` (`user_roles`, `has_role()`), `src/routes/AdminRoute.tsx`, `docs/SECURITY.md` |
| Erst-Admin | Sicherer, dokumentierter Bootstrap-Weg | `docs/FIRST_ADMIN.md` |
| Warenkörbe | Erstellen/Umbenennen/Duplizieren/Archivieren/Löschen mit Bestätigung, aktiver Warenkorb, Status, Kennzahlen-Anzeige | `src/pages/Dashboard.tsx`, `CartDetail.tsx`, `src/components/cart/*`, `supabase/migrations/0004_carts_and_items.sql`, `0011_cart_rpcs.sql` |
| Positionstabelle | Alle geforderten Spalten, Autoresolve, Validierung, Autosave mit Status, Mehrfach-Paste, Reorder/Duplizieren/Löschen, mobile Kartenansicht | `src/components/cart/CartItemsTable.tsx`, `CartItemsMobileList.tsx`, `PasteImportDialog.tsx`, `src/hooks/useCartItemRow.ts` |
| Produktdatenbank | Eindeutiger, normalisierter Code, Preis/Status/Zeitstempel, nur Admin-Schreibzugriff, CSV-Import/Export | `supabase/migrations/0003_products.sql`, `src/pages/admin/AdminProducts.tsx`, `src/services/csvProducts.ts` |
| Preis-Snapshots | Snapshot bei Hinzufügen, keine rückwirkende Verfälschung, explizite Preisaktualisierung mit Diff-Vorschau | `src/lib/snapshot.ts`, `src/components/cart/PriceUpdateDialog.tsx`, `supabase/migrations/0004_carts_and_items.sql`, `docs/KONZEPT.md` §5 |
| Wechselkurs | Externe Quelle, Zeitstempel, Caching, klarer Fallback, keine falschen EUR-Werte, zentrale Rundung, kein Key im Frontend | `supabase/functions/get-exchange-rate/index.ts`, `src/lib/money.ts`, `src/hooks/useExchangeRate.ts` |
| Summenanzeige | Sticky Desktop-Panel / mobile Sticky-Bar, sofortiges Update ohne Reload | `src/components/cart/CartSummaryPanel.tsx`, `CartSummaryBar.tsx`, `src/hooks/useCartComputed.ts` |
| PDF-Import | Validierung, PDF.js-Parsing, editierbare Vorschau, Fehler-/Duplikat-Markierung, transaktionaler Import, Ergebnis-Zusammenfassung, Import-Log | `src/pdf/parsePdf.ts`, `parseProductLines.ts`, `src/pages/admin/AdminPdfImport.tsx`, `supabase/migrations/0009_import_rpc.sql` (`apply_pdf_import`), `0006_pdf_imports.sql` |
| PDF-Sicherheit | Privater Storage-Bucket, nur Admins, restriktive Policies | `supabase/migrations/0008_storage.sql`, `docs/SECURITY.md` |
| Admin-Bereich | Produkte, PDF-Import, Import-Historie, Wechselkurs-Status, Nutzerverwaltung, Audit-Log, offene Datenprobleme | `src/pages/admin/*`, `src/components/admin/*`, `src/services/adminStats.ts` |
| Sicherheit | RLS auf allen Tabellen, keine Rechteausweitung über Frontend, keine Service-Role im Client, client- **und** serverseitige Validierung | alle `supabase/migrations/*.sql` (Policies), `docs/SECURITY.md`, `src/lib/validation.ts` (Zod) |
| Datenmodell | Alle geforderten Tabellen inkl. Historie/Snapshot/Audit | `supabase/migrations/0001`–`0013`, `docs/DATA_MODEL.md` |
| Fehler-/Edge-Cases | Unbekannter Code, inaktives/preisloses Produkt, ungültige Menge, Duplikate, Offline, API-Ausfall, abgelaufene Session, fehlende Rechte, unlesbares/OCR-pflichtiges PDF, gleichzeitige Änderungen (Optimistic Locking) | `docs/RISKS.md`, `src/lib/errors.ts`, `supabase/migrations/0012_optimistic_locking.sql`, `src/hooks/useOnlineStatus.ts` |
| Tests | Preisrechnung, Umrechnung, Validierung, Snapshot, PDF-Parsing, RLS-Szenarien, UI-Kernflüsse | `src/tests/*`, `supabase/tests/rls_test_scenarios.sql`, `docs/TEST_PLAN.md`, `docs/MANUAL_QA_CHECKLIST.md` |
| Code-Qualität | Strikte Typisierung, kein unnötiges `any`, zentrale Konfiguration, Linting/Formatierung | `tsconfig.app.json`, `eslint.config.js`, `.prettierrc.json`, `src/types/database.ts` |
| Deployment | GitHub Actions CI/CD, korrekter Vite-Basispfad, getrennte Secrets, Auth-Redirect-Doku | `.github/workflows/deploy.yml`, dieser README-Abschnitt |

**Bewusst nicht umgesetzt (mit Begründung):** OCR für gescannte PDFs ohne
Textebene, Mehrsprachigkeit (i18n), Checkout/Zahlungsabwicklung,
Tabellen-Virtualisierung für sehr große Warenkörbe, vollautomatisierte
Browser-E2E-Tests in CI. Details und Begründung je Punkt in
[`docs/RISKS.md`](docs/RISKS.md).

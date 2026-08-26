# Teststrategie

## Automatisiert (Vitest)

Ausführen: `npm test` (einmalig) oder `npm run test:watch` (Watch-Modus).
Coverage: `npm run test:coverage`.

| Bereich | Datei | Was wird getestet |
|---|---|---|
| Geldlogik/Rundung | `src/tests/money.test.ts` | Round-half-up, Cent-Rundung, Positionssumme, USD→EUR-Umrechnung ohne Rate = null, Formatierung |
| Validierung | `src/tests/validation.test.ts` | Artikelcode-Normalisierung, Mengen-Grenzen/-Format, Registrierungs-Schema, Paste-Import-Zeilenparser |
| Preis-Snapshot | `src/tests/snapshot.test.ts` | Snapshot-Erzeugung, Preis-Update-Diff-Berechnung (alt/neu/Differenz), kein Wert ohne Kurs |
| PDF-Heuristik | `src/tests/parseProductLines.test.ts` | Verschiedene Zeilenformate (Tab, Semikolon, Komma-/Punkt-Dezimal, Tausendertrennzeichen), Fehler-/Header-Erkennung, Duplikat-Flagging |
| Fehlerbehandlung | `src/tests/errors.test.ts` | Mapping bekannter Postgres-/Auth-Fehlercodes auf sichere, hilfreiche Meldungen |
| UI-Komponente | `src/tests/ConfirmDialog.test.tsx` | Rendering, Bestätigungs-Callback, Lade-/Deaktivierungszustand |

Diese Tests laufen in GitHub Actions bei jedem Push/PR (siehe
`.github/workflows/deploy.yml`) und müssen grün sein, bevor deployt wird.

## RLS- und Rollen-Prüfszenarien (manuell/semi-automatisiert)

`supabase/tests/rls_test_scenarios.sql` enthält nummerierte Szenarien
(eigene vs. fremde Daten, Rollen-Eskalation, optimistisches Locking,
Admin-only-Funktionen, Verhalten bei deaktivierten Produkten). Diese werden
gegen ein echtes Dev-/Staging-Supabase-Projekt mit zwei Testnutzern
ausgeführt, da RLS von `auth.uid()` aus einem echten JWT abhängt - ein
sinnvoller, isolierter CI-Lauf dafür würde ein dediziertes
Wegwerf-Supabase-Projekt in der Pipeline erfordern, was hier bewusst nicht
automatisiert wurde (siehe `docs/RISKS.md`, Punkt zu E2E-Tests).

## Manuelle Abnahme

Siehe `docs/MANUAL_QA_CHECKLIST.md` für die vollständige Klick-Checkliste
(Auth-Flows, Warenkorb-CRUD, Tabelle, PDF-Import, Admin-Bereich,
Fehlerfälle, Responsive-Verhalten).

## Was bewusst nicht automatisiert getestet wird

- **Echte E2E-Browsertests (Playwright/Cypress) gegen eine laufende
  Supabase-Instanz**: würde Secrets und ein Testprojekt in CI erfordern.
  Stattdessen: Unit-/Komponententests für Logik + manuelle Checkliste für
  Flows.
- **Wechselkurs-API-Erreichbarkeit**: kann nicht sinnvoll deterministisch in
  CI getestet werden; die Fallback-Logik selbst (Cache, `stale`-Flag,
  `rate: null` ohne Cache) ist im Code so geschrieben, dass sie isoliert
  testbar wäre, sobald ein Mock für die Edge-Function-Umgebung (Deno)
  eingerichtet wird - aktuell durch Code-Review und die dokumentierten
  Szenarien in `docs/KONZEPT.md` §6 abgedeckt.

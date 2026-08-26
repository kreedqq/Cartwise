# Konzept: Gemeinsame Warenkörbe & Bestelllisten

Dieses Dokument fasst Anforderungsanalyse, Annahmen, Architektur, Datenmodell,
Sicherheitskonzept und Risiken zusammen, bevor der Code betrachtet wird.
Es ist die Grundlage für alle Implementierungsentscheidungen im Repository.

## 1. Annahmen (getroffen, um ohne Rückfrage weiterarbeiten zu können)

Alle Annahmen sind bewusst konservativ (sicher, Standard-Praxis) gewählt, damit
sie ohne Rückfrage vertretbar sind. Sie sind unten mit Begründung dokumentiert
und an genau einer Stelle im Code/Doku verankert, damit sie später leicht
geändert werden können.

| # | Annahme | Begründung |
|---|---------|------------|
| A1 | Listenpreise in der Produktdatenbank sind immer in USD hinterlegt (`currency` Feld existiert für zukünftige Erweiterung, aktuell nur `USD`). | Anforderung fordert USD-Preise als Basis; Mehrwährungsfähigkeit wird als Erweiterungspunkt vorbereitet, aber nicht umgesetzt, da nicht gefordert. |
| A2 | Wechselkursquelle: [Frankfurter API](https://frankfurter.dev) (Europäische Zentralbank, täglich aktualisiert, kein API-Key nötig, kostenlos, keine dokumentierten Rate-Limits). | Seriöse, öffentliche Quelle (EZB-Referenzkurse), kein Secret-Handling nötig, reduziert Betriebsrisiko. Alternative (z. B. exchangerate-api.com) ist in `docs/ARCHITECTURE.md` als Ersatzoption dokumentiert, falls ein Schlüssel-basierter Anbieter gewünscht wird. |
| A3 | Duplikat-Artikelcodes **innerhalb desselben Warenkorbs** werden **nicht automatisch zusammengeführt**, sondern als separate Positionen erlaubt (wie in Excel), aber deutlich als Duplikat markiert mit optionalem manuellem "Zusammenführen"-Befehl. | Zusammenführen ohne Rückfrage kann Notizen/Kontext verlieren; automatisches, stilles Merge widerspricht der Nachvollziehbarkeit. Explizite Nutzerentscheidung ist sicherer. |
| A4 | Löschen von Warenkörben und Produkten ist **Soft-Delete** (`deleted_at` / `is_active`), damit referenzierte historische Daten (Snapshots, Preis-Historie, Audit-Log) konsistent bleiben. Hartes Löschen von Produkten ist nur erlaubt, wenn das Produkt in keinem `cart_item` referenziert wird. | Erfüllt Anforderung 14 ("gelöschte/deaktivierte Produkte in historischen Warenkörben") ohne Integritätsverlust. |
| A5 | Erster Admin wird **nicht** per Self-Service-UI angelegt, sondern durch einen einmaligen, dokumentierten SQL-Befehl im Supabase SQL Editor nach der ersten Registrierung. | Verhindert, dass sich ein beliebiger Nutzer selbst zum Admin machen kann (Sicherheitsprinzip: keine Rechteausweitung über die UI). |
| A6 | OCR für gescannte PDFs ohne Textlayer wird **nicht** implementiert. Stattdessen: klare Erkennung "kein Textlayer", Hinweis im UI und manuelle Text-/CSV-Fallback-Eingabe. | Verlässliche OCR (z. B. Tesseract im Browser) ist groß, langsam, fehleranfällig und außerhalb der Kernanforderung "seriöse, nachvollziehbare Pipeline". Eine falsche automatische Erkennung wäre riskanter als ein klarer manueller Fallback. |
| A7 | UI-Sprache: Deutsch (wie Anfrage), Code/Kommentare: Englisch (Industriestandard, bessere Wartbarkeit/Anschlussfähigkeit). | Trennung von Produkttext (lokalisierbar) und Code. |
| A8 | Komponentenbasis: eigene, mit Radix UI + Tailwind gebaute Komponenten im shadcn/ui-Stil, statt shadcn-CLI-Generierung. | Die shadcn-CLI lädt Komponenten zur Laufzeit von einer Registry nach; das ist im Ergebnis (Code) identisch zu handgeschriebenen Radix+Tailwind-Komponenten, aber ohne Laufzeit-Abhängigkeit von einem externen Registry-Server beim Setup. Ergebnis ist barrierearm (Radix), typsicher und stilistisch gleichwertig. |
| A9 | Zahlungsabwicklung/Bestellauslösung an Dritt-Systeme ist **nicht** Teil des Funktionsumfangs; "Bestellliste" endet mit Status `ordered` als Vermerk, kein Checkout-Prozess. | Anforderung beschreibt Warenkorb-/Listenverwaltung, keinen Zahlungsfluss. |
| A10 | Mengeneinheit ist eine ganzzahlige oder Dezimal-Menge (bis 3 Nachkommastellen, z. B. für Gebinde/kg); Obergrenze 100.000 Stück pro Position als Plausibilitätsgrenze gegen Fehleingaben. | Anforderung 14 nennt "extrem große" Mengen als Fehlerfall; eine harte, dokumentierte Grenze verhindert Overflow/Fehlbedienung, ist aber großzügig genug für reale Fälle. |
| A11 | GitHub Pages dient ausschließlich dem Frontend-Hosting; alle geschützten Operationen (Rollenvergabe, Produktimport, Wechselkurs-Fetch mit evtl. Secret) laufen über Supabase Edge Functions bzw. RLS-gesicherte Postgres-Funktionen. | Explizite Vorgabe der Aufgabenstellung. |

Keine der obigen Annahmen erzeugt ein Sicherheitsrisiko oder eine irreversible
Festlegung — alle sind in Migrationen/Konfiguration klar benannt und änderbar.

## 2. Architekturüberblick

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  GitHub Pages (statisch)    │  HTTPS │  Supabase Projekt              │
│  React + TS + Vite SPA      │◄──────►│  - Postgres (RLS)              │
│  Tailwind + Radix UI        │        │  - Auth (Email/Passwort, Magic │
│  React Query + React Router │        │    Link)                       │
│                              │        │  - Storage (pdf-imports Bucket)│
│                              │        │  - Edge Functions              │
│                              │        │    - get-exchange-rate         │
│                              │        │    - set-user-role             │
│                              │        │  - RPC apply_pdf_import()      │
│                              │        │    (SQL, admin-checked)        │
└─────────────────────────────┘        └──────────────────────────────┘
              │
              │ clientseitig (kein Secret)
              ▼
      PDF.js (Textextraktion im Browser)
```

**Warum dieser Zuschnitt:**

- **SPA auf GitHub Pages**: erfüllt die Vorgabe, keine geheimen Schlüssel im
  Frontend zu benötigen. Der Anon-Key ist per Definition öffentlich
  (client-seitig, RLS-geschützt) und darf im Bundle liegen.
- **Supabase als Backend**: Auth, RLS-gesicherte Postgres-DB, Storage und Edge
  Functions in einem Projekt — deckt alle Backend-Anforderungen ohne
  zusätzliche Infrastruktur.
- **Edge Functions statt Frontend-Fetch** für den Wechselkurs: verhindert
  übermäßige/parallele Client-Aufrufe (Caching serverseitig in `exchange_rates`),
  hält die Tür für einen künftigen Schlüssel-basierten Anbieter offen, ohne
  das Frontend anzufassen, und zentralisiert Fallback-Logik.
- **Datenbankfunktion `apply_pdf_import` (statt Edge Function)**: führt den
  eigentlichen PDF-/CSV-Import als eine einzige Postgres-Funktion (= eine
  Transaktion) aus, statt vieler einzelner Client-Requests. Da die Funktion
  ohnehin nur Tabellen beschreibt, für die RLS bereits "nur Admin" erzwingt,
  ist eine zusätzliche Edge Function hier unnötige Komplexität; die Funktion
  prüft die Admin-Rolle zusätzlich selbst (defense in depth) und schreibt
  einen Audit-Log-Eintrag.
- **Edge Function `set-user-role`**: einzige Stelle, die Rollen ändert; prüft
  serverseitig, dass der Aufrufer bereits Admin ist (RLS allein reicht hier
  nicht aus, weil sie eine sichere, auditierte Mutation kapselt).
- **PDF.js im Browser**: Textextraktion ist rein lesend und unkritisch; sie im
  Client auszuführen spart eine Server-Roundtrip-Infrastruktur und funktioniert
  ohne zusätzliche Kosten. Der **Import selbst** (Schreiben in die DB) läuft
  serverseitig über die Edge Function.
- **React Query**: serverseitiger Cache/Sync-Status, Optimistic Updates,
  Retry-Verhalten für "langsame Verbindung" / "keine Verbindung"-Fälle.

## 3. Datenmodell (Übersicht)

Vollständige SQL-Migrationen: `supabase/migrations/`. Ausführliche
Feldbeschreibung: `docs/DATA_MODEL.md`.

- **profiles** (1:1 zu `auth.users`) — Anzeigename, Zeitstempel.
- **user_roles** — (`user_id`, `role`), `role` ∈ {`user`, `admin`}, UNIQUE je
  (`user_id`, `role`). Getrennt von `profiles`, damit Rollenlogik isoliert und
  über eine `SECURITY DEFINER`-Funktion (`has_role`) geprüft werden kann (kein
  rekursives RLS, kein Vertrauen auf Frontend-Zustand).
- **products** — zentrale Produktdatenbank, `code` normalisiert (trim + upper),
  UNIQUE, Preis in `price_usd` (numeric, `>= 0`), `is_active`, Zeitstempel.
- **product_price_history** — ein Eintrag pro Preisänderung (alter/neuer Preis,
  wer, wann) — Grundlage für Nachvollziehbarkeit unabhängig von Cart-Snapshots.
- **carts** — je Nutzer, Name, Status (`draft|ready|ordered|archived`), Notiz,
  `is_active_cart` (genau ein aktiver Warenkorb pro Nutzer, per partiellem
  Unique-Index), `deleted_at`, `version` (optimistisches Locking).
- **cart_items** — Position im Warenkorb: `product_id` (nullable, `ON DELETE
  SET NULL`), Menge, **Preis-Snapshot-Felder** (`unit_price_usd_snapshot`,
  `exchange_rate_snapshot`, `eur_value_snapshot`, `price_snapshot_at`,
  `product_name_snapshot`, `product_code_snapshot`), Notiz, Position/Sortierung,
  `version`.
- **exchange_rates** — historisierte Kursabrufe (`base`, `quote`, `rate`,
  `fetched_at`, `source`), dient als Cache und Fallback-Quelle ("letzter
  bekannter Kurs").
- **pdf_imports** — ein Datensatz je Importvorgang (Datei-Referenz in Storage,
  Nutzer, Zeitpunkt, Status, Zusammenfassung erstellt/aktualisiert/übersprungen/fehlgeschlagen).
- **pdf_import_rows** — jede erkannte/bearbeitete Zeile eines Imports mit
  Rohdaten, korrigierten Daten, gewählter Aktion, Ergebnis, Fehlermeldung.
- **audit_logs** — generisches Änderungsprotokoll (Produkt- und
  Rollenänderungen, Importe), `actor_id`, `action`, `entity`, `before`/`after`
  als JSONB.

Alle Tabellen: `created_at`/`updated_at` (Trigger `set_updated_at`), sinnvolle
Indizes auf Fremdschlüsseln und Suchfeldern, `CHECK`-Constraints für Preise,
Mengen und Status-Enums.

## 4. Sicherheitskonzept (Kurzfassung — Details in `docs/SECURITY.md`)

Leitprinzip: **"Minimal erforderliche Rechte", geprüft in der Datenbank, nicht
im Frontend.**

1. RLS ist auf **jeder** Tabelle mit Nutzerbezug aktiv (`ENABLE ROW LEVEL
   SECURITY`, keine Tabelle mit `FORCE ROW LEVEL SECURITY` ausgenommen).
2. Rollenprüfung über `has_role(uid, role)` (SQL-Funktion, `SECURITY DEFINER`,
   `SET search_path = public`), damit Policies nicht rekursiv auf `user_roles`
   zugreifen müssen und ein Nutzer sich nicht selbst eine Rolle zuweisen kann
   (INSERT/UPDATE/DELETE auf `user_roles` ist ausschließlich über die
   Edge Function `set-user-role` mit Service-Role möglich; RLS auf
   `user_roles` selbst lässt nur `SELECT` der eigenen Zeile zu).
3. `carts`/`cart_items`: Policies filtern strikt auf `user_id = auth.uid()`
   bzw. auf den Besitzer des zugehörigen Warenkorbs (Subquery/JOIN in der
   Policy). Kein Nutzer kann fremde IDs erraten und Daten lesen/schreiben.
4. `products`: `SELECT` für alle eingeloggten Nutzer auf aktive Produkte;
   `INSERT/UPDATE/DELETE` ausschließlich für Admins (`has_role(..., 'admin')`).
5. `pdf_imports`/`pdf_import_rows`/Storage-Bucket `pdf-imports`: nur Admins
   (Policies + Storage-Policies auf Bucket-Ebene).
6. `audit_logs`: `INSERT` nur serverseitig (Trigger/Edge Function mit
   Service-Role), `SELECT` nur für Admins.
7. Kein Service-Role-Key im Frontend; er existiert ausschließlich als Supabase
   Secret der Edge Functions.
8. Eingabevalidierung doppelt: Zod-Schemas im Client (UX, sofortiges Feedback)
   **und** `CHECK`-Constraints/Trigger/Edge-Function-Validierung in der DB
   (Sicherheit — das Frontend ist nicht vertrauenswürdig).
2. Datei-Uploads: Bucket privat, Policies binden Pfad an `auth.uid()` +
   Admin-Rolle, Content-Type auf `application/pdf` beschränkt, Größenlimit
   (10 MB) client- und bucket-seitig.
9. Keine sensiblen Fehlerdetails im UI: Fehler werden client-seitig auf
   generische, hilfreiche Meldungen gemappt; technische Details nur in der
   Browser-Konsole (Dev) bzw. Supabase Logs (Server).

## 5. Preis-Snapshot-Strategie (dokumentiert)

- Beim **Hinzufügen** einer Position wird sofort ein Snapshot geschrieben
  (Produktname, Einzelpreis USD, aktueller Wechselkurs, daraus berechneter
  EUR-Betrag, Zeitpunkt).
- Änderungen an `products.price_usd` **verändern bestehende `cart_items`
  nicht** automatisch — nur `product_price_history` wird ergänzt (Trigger).
- Der Nutzer sieht pro Position und im Summary, **wann** der Preis zuletzt
  übernommen wurde, und ob der aktuelle Produktpreis/Kurs vom Snapshot
  abweicht (dezenter Hinweis "Preis hat sich geändert").
- Aktion **"Preise aktualisieren"** (auf Zeilen- oder Warenkorbebene) zeigt
  eine Vorschau (alt → neu, Differenz USD/EUR) und schreibt bei Bestätigung
  einen neuen Snapshot. Alte Werte werden nicht gelöscht, sondern sind über
  `product_price_history` weiterhin nachvollziehbar.
- Wird ein Produkt später deaktiviert/gelöscht, bleibt der Snapshot (inkl.
  `product_name_snapshot`/`product_code_snapshot`) in der Position erhalten;
  die Position wird visuell als "Produkt nicht mehr verfügbar" markiert,
  bleibt aber in Summen enthalten (der Snapshot-Preis gilt weiter, da er der
  zuletzt bekannte, für den Nutzer sichtbare Preis war).

## 6. Wechselkurs-Strategie

- Primärquelle: Frankfurter API (EZB-Referenzkurse, täglich), abgerufen durch
  die Edge Function `get-exchange-rate`.
- Cache: Edge Function prüft zuerst `exchange_rates` (neuester Eintrag). Ist
  der Eintrag jünger als `EXCHANGE_RATE_CACHE_MINUTES` (Default 60 Minuten),
  wird er zurückgegeben, ohne die externe API erneut aufzurufen.
- Fallback: Schlägt der externe Abruf fehl, wird der zuletzt gespeicherte Kurs
  zurückgegeben, markiert mit `stale: true` und dessen echtem Zeitstempel.
  Existiert **kein** historischer Kurs, liefert die Funktion `rate: null` —
  das Frontend zeigt dann klar "Kein Wechselkurs verfügbar" und unterdrückt
  jede EUR-Berechnung (nie ein falscher/geratener Wert).
- Rundung: zentral in `src/lib/money.ts` — Beträge werden intern in
  Minor-Units (Cent, `Math.round`) gerechnet, kaufmännisch gerundet
  ("round half up"), nie durch verteilte `toFixed()`-Aufrufe im UI.

## 7. Risiken & bewusste Grenzen

| Risiko | Umgang |
|---|---|
| PDF-Layouts sind extrem heterogen; ein generischer Parser erkennt nicht jede Tabelle korrekt. | Heuristischer Parser + verpflichtende, editierbare Admin-Vorschau vor jedem Import; nichts wird "still" übernommen. Zeilen mit Unsicherheit werden markiert (`warning`/`error`), nie automatisch importiert. |
| Gescannte PDFs ohne Textlayer liefern keine Daten. | Sofortige Erkennung + Hinweis + manueller Text-/CSV-Fallback, keine unsichere OCR-Vermutung. |
| Wechselkurs-API nicht erreichbar (Ausfall, Netzsegmentierung, Rate-Limit). | Cache + letzter bekannter Kurs mit „veraltet"-Kennzeichnung; nie ein synthetischer Kurs. |
| Konkurrierende Änderungen an Warenkorb/Produktpreis (zwei Tabs, zwei Geräte). | Optimistisches Locking über `version`-Spalte; Konflikt führt zu klarer Meldung + Reload der Zeile statt stillem Überschreiben. |
| Sehr große Warenkörbe (Performance der Tabelle). | Virtualisierung nicht in v1 umgesetzt (Komplexität vs. Nutzen bei realistischen Warenkorbgrößen), aber Paginierung/serverseitige Sortierung in der Datenzugriffsschicht vorbereitet; dokumentiert als bekannte Grenze (siehe `docs/RISKS.md`). |
| Admin kann durch fehlerhaften PDF-Import Produktdaten verfälschen. | Transaktionaler Import (alles oder nichts pro Batch in der Edge Function), vollständiges Protokoll in `pdf_imports`/`pdf_import_rows`, keine Hard-Deletes von Produkten während des Imports (nur create/update/skip). |
| GitHub Pages ist rein statisch — kein serverseitiges Secret-Handling möglich. | Alle Secrets ausschließlich in Supabase (Edge Function Secrets); Frontend erhält nur den öffentlichen Anon-Key. |
| Self-Signup könnte missbraucht werden, um sich Admin-Rechte zu erschleichen. | Rollentabelle ist nur serverseitig beschreibbar (Edge Function mit Service-Role + Admin-Check); erster Admin nur per SQL durch Projektinhaber. |
| Abgelaufene Session mitten in der Bearbeitung. | Supabase-Client mit Auto-Refresh; bei endgültigem Ablauf: Redirect zu `/login` mit Hinweis, ungespeicherte Eingaben werden vor Redirect nach Möglichkeit im lokalen State gehalten und nach Re-Login wiederhergestellt (best effort, kein Datenverlust bei Autosave-Erfolg vor Ablauf). |

Weitere, detailliertere Risikobetrachtung: `docs/RISKS.md`.
Ausführliche Sicherheits-/RLS-Dokumentation: `docs/SECURITY.md`.
Vollständige Feldreferenz: `docs/DATA_MODEL.md`.

# Sicherheitskonzept & RLS-Dokumentation

## Grundprinzipien

1. **Datenbank ist die Vertrauensgrenze.** Jede Zugriffsentscheidung, die
   sicherheitsrelevant ist, wird durch Postgres Row Level Security (RLS) oder
   eine `SECURITY DEFINER`-Funktion/Edge Function mit Service-Role
   durchgesetzt — niemals nur im Frontend. Das Frontend blendet
   Admin-Funktionen aus Komfortgründen aus, verlässt sich aber nicht darauf.
2. **Minimal erforderliche Rechte** je Rolle und Tabelle (siehe Matrix unten).
3. **Keine Rekursion / kein Vertrauen auf Client-Claims** für Rollenprüfung:
   die Funktion `has_role(_user_id uuid, _role text) RETURNS boolean` ist
   `SECURITY DEFINER`, `SET search_path = public`, liest `user_roles` mit
   erhöhten Rechten und wird in Policies referenziert. Sie kann nicht durch
   RLS auf `user_roles` selbst blockiert werden.
4. **Rollenvergabe** erfolgt ausschließlich über die Edge Function
   `set-user-role`, die mit dem Service-Role-Key arbeitet und selbst prüft,
   dass der aufrufende Nutzer bereits `admin` ist (Ausnahme: der in
   `FIRST_ADMIN.md` beschriebene einmalige SQL-Bootstrap durch den
   Projektinhaber). `user_roles` hat daher **keine** clientseitigen
   INSERT/UPDATE/DELETE-Policies für normale Nutzer.

## RLS-Policy-Matrix

| Tabelle | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | eigene Zeile (`id = auth.uid()`) | via Trigger bei Signup | eigene Zeile | – |
| `user_roles` | eigene Zeile ODER Admin (alle) | nur Service-Role (Edge Function) | nur Service-Role | nur Service-Role |
| `products` | alle eingeloggten Nutzer, nur `is_active = true` (Admins sehen auch inaktive) | nur Admin | nur Admin | nur Admin (siehe Guard unten) |
| `product_price_history` | nur Admin | nur Trigger (Server) | – | – |
| `carts` | Besitzer (`user_id = auth.uid()`), `deleted_at IS NULL` (Besitzer kann eigene gelöschte per expliziter Abfrage weiter nicht sehen – endgültig) | Besitzer (`user_id = auth.uid()`) | Besitzer | Besitzer (Soft-Delete per UPDATE; Hard-Delete-Policy zusätzlich vorhanden, wird aber vom Client nicht genutzt) |
| `cart_items` | Besitzer des zugehörigen Carts | Besitzer des zugehörigen Carts | Besitzer | Besitzer |
| `exchange_rates` | alle eingeloggten Nutzer (lesend, keine Geheimnisse) | nur Service-Role (Edge Function) | – (append-only) | – |
| `pdf_imports` | nur Admin | nur Admin | nur Admin | – |
| `pdf_import_rows` | nur Admin (über Join auf `pdf_imports`) | nur Admin/Service-Role | nur Admin | – |
| `audit_logs` | nur Admin | nur Trigger/Service-Role | – | – |

Alle "Besitzer"-Policies verwenden `auth.uid()` serverseitig aus dem
verifizierten JWT — nicht aus einem vom Client mitgesendeten Feld.

## Beispielhafte Policy-Formulierung (siehe Migrationen für Volltext)

```sql
-- carts: Besitzer-Policy
create policy "carts_select_own" on public.carts
  for select using (user_id = auth.uid() and deleted_at is null);

create policy "carts_admin_can_view_all" on public.carts
  for select using (public.has_role(auth.uid(), 'admin'));

-- cart_items: Besitz wird über den Cart geprüft
create policy "cart_items_select_own" on public.cart_items
  for select using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

-- products: Schreibzugriff nur Admin
create policy "products_write_admin" on public.products
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
```

## Storage (Bucket `pdf-imports`)

- Bucket ist **privat** (kein Public-Access).
- Policy: `SELECT`/`INSERT` nur, wenn `has_role(auth.uid(), 'admin')` **und**
  Pfadpräfix `admin-uploads/` verwendet wird (verhindert Path-Traversal /
  Erraten fremder Pfade).
- Erlaubte Content-Types werden zusätzlich clientseitig (Dateiendung +
  `type`-Header) und in der Edge Function (Magic-Bytes-Check `%PDF`) geprüft.
- Maximale Dateigröße: 10 MB (clientseitig und als `CHECK` auf
  `pdf_imports.file_size_bytes`).

## Schutz vor typischen Angriffsklassen

- **IDOR (Insecure Direct Object Reference):** Jede Detailroute
  (`/carts/:id`) lädt Daten über RLS-gefilterte Queries; eine fremde,
  erratene ID liefert schlicht keine Zeile (nicht "403", sondern "not found"
  — verhindert Enumeration von Existenz).
- **Privilege Escalation über das Frontend:** Rollenwechsel ist nie eine
  reine Client-Mutation; `AdminRoute` prüft zusätzlich serverseitig über
  `has_role` in jeder admin-only Query/Policy, nicht nur im UI-Routing.
- **Mass Assignment:** Zod-Schemas whitelisten erlaubte Felder pro Formular;
  Supabase-Inserts senden nie ungefilterte Objekte.
- **Race Conditions / Lost Updates:** `version`-Spalte + `WHERE version =
  :expected` bei UPDATE; 0 betroffene Zeilen ⇒ Konflikt-Fehler im UI.
- **Dateiupload-Missbrauch:** Größen-/Typprüfung mehrfach (Client, Bucket
  Policy, Server-Validierung der Magic Bytes in der Edge Function).
- **Informationslecks über Fehlermeldungen:** `src/lib/errors.ts` mappt
  bekannte Postgres-/Supabase-Fehlercodes auf generische, hilfreiche
  deutsche Texte; Rohdetails werden nur in der Browser-Konsole (Dev-Modus)
  protokolliert.

## Bekannte Annahmen / Grenzen

- E-Mail-Verifizierung hängt von der Supabase-Projekteinstellung ab (per
  Default aktiv); die App unterstützt beide Modi (mit/ohne Pflicht-Verifizierung).
- Es gibt keine Rate-Limiting-Schicht im Frontend; Supabase Auth bringt
  eigene Basis-Ratenlimits mit. Für Produktivbetrieb mit hohem Risiko wird
  zusätzlich Supabase's "Leaked Password Protection" und CAPTCHA (falls im
  Projekt verfügbar) empfohlen (siehe `docs/PRODUCTION_CHECKLIST.md`).

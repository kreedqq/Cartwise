# Datenmodell – Feldreferenz

Quelle der Wahrheit sind die SQL-Migrationen in `supabase/migrations/`. Dieses
Dokument beschreibt die Tabellen in Textform als Referenz.

## profiles
1:1 Erweiterung von `auth.users`.

| Feld | Typ | Beschreibung |
|---|---|---|
| id | uuid, PK, FK → auth.users(id) ON DELETE CASCADE | |
| display_name | text, NOT NULL, CHECK length 1–80 | Anzeigename |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, default now() | via Trigger aktualisiert |

Wird per Trigger `handle_new_user` bei Registrierung automatisch angelegt
(Default-Anzeigename = lokaler Teil der E-Mail).

## user_roles
| Feld | Typ | Beschreibung |
|---|---|---|
| id | uuid, PK, default gen_random_uuid() | |
| user_id | uuid, FK → auth.users(id) ON DELETE CASCADE | |
| role | text, CHECK IN ('user','admin') | |
| created_at | timestamptz | |

UNIQUE (`user_id`, `role`). Index auf `user_id`. Schreibzugriff ausschließlich
über Edge Function `set-user-role` (Service-Role).

## products
| Feld | Typ | Beschreibung |
|---|---|---|
| id | uuid, PK | |
| code | text, NOT NULL | normalisiert: `upper(trim(code))` via Trigger |
| name | text, NOT NULL, CHECK length ≥ 1 | |
| description | text, nullable | |
| category | text, nullable | |
| price_usd | numeric(12,4), NOT NULL, CHECK ≥ 0 | |
| currency | text, NOT NULL, default 'USD', CHECK = 'USD' | Erweiterungspunkt |
| is_active | boolean, NOT NULL, default true | |
| last_price_change_at | timestamptz, nullable | via Trigger gesetzt |
| created_at / updated_at | timestamptz | |

UNIQUE Index auf `code` (normalisiert). Index auf `is_active`, `category`.
Trigger `products_before_write`: normalisiert `code`, validiert Preis,
schreibt bei Preisänderung `product_price_history` und aktualisiert
`last_price_change_at`.

## product_price_history
| Feld | Typ |
|---|---|
| id | uuid PK |
| product_id | uuid FK → products(id) ON DELETE CASCADE |
| old_price_usd | numeric(12,4), nullable (null bei Neuanlage) |
| new_price_usd | numeric(12,4) NOT NULL |
| changed_by | uuid FK → auth.users(id), nullable (System) |
| changed_at | timestamptz default now() |

Index auf `product_id, changed_at DESC`.

## carts
| Feld | Typ | Beschreibung |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users(id) ON DELETE CASCADE | |
| name | text NOT NULL CHECK length 1–120 | |
| status | text CHECK IN ('draft','ready','ordered','archived') default 'draft' | |
| note | text nullable | |
| is_active_cart | boolean NOT NULL default false | genau ein aktiver Warenkorb je Nutzer |
| deleted_at | timestamptz nullable | Soft Delete |
| version | integer NOT NULL default 1 | optimistisches Locking |
| created_at / updated_at | timestamptz | |

Partieller UNIQUE Index: `(user_id) WHERE is_active_cart AND deleted_at IS
NULL` — stellt sicher, dass pro Nutzer höchstens ein Warenkorb aktiv ist.
Index auf `(user_id, deleted_at)`.

## cart_items
| Feld | Typ | Beschreibung |
|---|---|---|
| id | uuid PK | |
| cart_id | uuid FK → carts(id) ON DELETE CASCADE | |
| position | integer NOT NULL | Anzeige-/Sortierreihenfolge |
| product_id | uuid FK → products(id) ON DELETE SET NULL, nullable | |
| product_code_input | text NOT NULL | vom Nutzer eingegebener Code (roh) |
| product_code_snapshot | text nullable | normalisierter Code zum Snapshot-Zeitpunkt |
| product_name_snapshot | text nullable | |
| quantity | numeric(12,3) NOT NULL CHECK (quantity > 0 AND quantity <= 100000) | |
| unit_price_usd_snapshot | numeric(12,4) nullable | |
| exchange_rate_snapshot | numeric(12,6) nullable | |
| eur_value_snapshot | numeric(12,2) nullable | Menge × Einzelpreis × Kurs, gerundet |
| price_snapshot_at | timestamptz nullable | |
| resolution_status | text CHECK IN ('resolved','not_found','inactive','pending') default 'pending' | |
| note | text nullable | |
| version | integer NOT NULL default 1 | |
| created_at / updated_at | timestamptz | |

Index auf `(cart_id, position)`. Index auf `product_id`. Trigger
`bump_cart_updated_at` propagiert Änderungen an `carts.updated_at`.

**Duplikate:** Mehrere Zeilen mit demselben `product_code_snapshot` im
selben Warenkorb sind zulässig (siehe Annahme A3 in `KONZEPT.md`); das
Frontend berechnet eine Duplikat-Warnung clientseitig aus den geladenen
Zeilen.

## exchange_rates
| Feld | Typ |
|---|---|
| id | uuid PK |
| base_currency | text NOT NULL default 'USD' |
| quote_currency | text NOT NULL default 'EUR' |
| rate | numeric(12,6) NOT NULL CHECK (rate > 0) |
| source | text NOT NULL | z. B. `frankfurter.dev` |
| fetched_at | timestamptz NOT NULL default now() |

Index auf `(base_currency, quote_currency, fetched_at DESC)`. Es wird nie
`UPDATE`t, sondern historisierend `INSERT`et (append-only Log +
gleichzeitig Cache-Quelle).

## pdf_imports
| Feld | Typ |
|---|---|
| id | uuid PK |
| uploaded_by | uuid FK → auth.users(id) |
| file_path | text NOT NULL | Pfad im Storage-Bucket `pdf-imports` |
| file_name | text NOT NULL |
| file_size_bytes | integer NOT NULL CHECK (> 0 AND <= 10485760) |
| status | text CHECK IN ('uploaded','previewed','applied','failed','cancelled') |
| has_text_layer | boolean nullable |
| summary_created | integer default 0 |
| summary_updated | integer default 0 |
| summary_skipped | integer default 0 |
| summary_failed | integer default 0 |
| error_message | text nullable |
| created_at / updated_at | timestamptz |

## pdf_import_rows
| Feld | Typ |
|---|---|
| id | uuid PK |
| import_id | uuid FK → pdf_imports(id) ON DELETE CASCADE |
| row_number | integer |
| raw_text | text | extrahierte Rohzeile |
| parsed_code | text nullable |
| parsed_name | text nullable |
| parsed_price_usd | numeric(12,4) nullable |
| quality | text CHECK IN ('ok','warning','error') |
| quality_reason | text nullable |
| action | text CHECK IN ('create','update','skip') nullable | Admin-Entscheidung |
| target_product_id | uuid FK → products(id), nullable | bei `update` |
| result | text CHECK IN ('created','updated','skipped','failed') nullable |
| result_message | text nullable |

Index auf `(import_id, row_number)`.

## audit_logs
| Feld | Typ |
|---|---|
| id | uuid PK |
| actor_id | uuid FK → auth.users(id), nullable |
| action | text NOT NULL | z. B. `product.update`, `role.grant`, `import.apply` |
| entity_type | text NOT NULL |
| entity_id | uuid nullable |
| before_data | jsonb nullable |
| after_data | jsonb nullable |
| created_at | timestamptz default now() |

Index auf `(entity_type, entity_id, created_at DESC)` und `(actor_id,
created_at DESC)`. Nur per Trigger/Service-Role beschrieben (siehe
`docs/SECURITY.md`).

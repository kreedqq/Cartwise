# Production Backup 2026-08-28

**Status:** **BACKUP_READY_WITH_LIMITATION**  
**Scope:** restore-friendly dump only. No research migrations. `0024`–`0029` not applied.

## Backup timestamp

2026-08-28 (evening, local). Tool: Supabase CLI `2.115.0` + Docker Engine `29.7.2` (`desktop-linux`), image `public.ecr.aws/supabase/postgres:17.6.1.165`.

## Database target

| | |
|---|---|
| Project | `cartwise-prod` (only project in the org) |
| Ref | `cnjrjinvxycdkrmzcime` |
| Region | `eu-west-2` |
| Status | `ACTIVE_HEALTHY` |

`supabase/config.toml` `project_id = shared-cart-app` is the local CLI name, not the live ref. Dump used `--project-ref cnjrjinvxycdkrmzcime`.

## Migration status before backup

**0023** (`reconstitution_water_and_ordered_cart_lock`). Research tables absent. After dump (read-only): still **0023**, 320 products, 2 active carts, 0 orders.

## Backup files

Location **outside** the git repo: `C:\Users\PolatMehmetErkan\Documents\cartwise-prod-backup\`

| File | Type | Size | SHA-256 |
|---|---|---|---|
| `cartwise-prod-0023-2026-08-28-schema.sql` | plain SQL schema (`pg_dump` via CLI) | 197964 bytes | `0b5ceec29d490e9d969af54917ecbfd9ece62f814a9750ff4d60a6117d0b2440` |
| `cartwise-prod-0023-2026-08-28-data.sql` | plain SQL data (`COPY`) | 1032523 bytes | `a35b94190a9fa30677f470108159c8aa1837b6dbb52d4b435907bda6a8927c86` |
| `cartwise-prod-0023-2026-08-28-full.sql` | schema + data concatenated | 1230487 bytes | `dae0ef581968cdd7a33eb5dc34c44064a0ff8fbfaa89a666b6e25d5897cb973a` |

Primary artifact for restore: **`cartwise-prod-0023-2026-08-28-full.sql`**.

Not custom/`pg_restore` format (`pg_restore --list` does not apply). None of these files is 0 bytes.

## Content validation

Schema dump: 51 `CREATE TABLE IF NOT EXISTS`, 92 indexes, 114 `ADD CONSTRAINT`, 44 RLS enables, 39 `CREATE POLICY`.

| Object | In schema dump | In data dump | COPY row count |
|---|---|---|---|
| `public.products` | present | present | 320 |
| `public.carts` | present | present | 6 (all rows; 2 are active live) |
| `public.orders` | present | present | 0 |
| `auth.users` | present | present | 2 |
| `supabase_migrations.schema_migrations` | present | present | 23 |

Schemas included: `public`, `auth`, `storage`, `supabase_migrations`.

## Restore test

**Attempted on a local Docker Postgres. Not restored to production.**

| Attempt | Result |
|---|---|
| `public.ecr.aws/supabase/postgres:17.6.1.165` | Failed (`could not open relation with OID …`; `permission denied to set parameter "session_replication_role"`). Shop tables did not appear. |
| Vanilla `postgres:17` (`ON_ERROR_STOP` off) | 235 schema errors (missing roles such as `supabase_admin` / `supabase_auth_admin`). `public.products` existed afterward with **320** rows. |

Clean full restore was **not** demonstrated. Role-only dump was not written.

**Restore test status:** attempted; **not a successful full restore**. Do not treat this as proven one-command disaster recovery onto empty Postgres.

## Known limitations

- Org plan is **free**: no platform daily/PITR backups; this local dump is the restore image.
- No `--role-only` file; vanilla Postgres restore hits missing Supabase roles.
- Dump is plain SQL, not `pg_dump -Fc`.
- Storage **objects** (S3) are not in a SQL dump; only DB metadata if present in `storage` schema.
- `.env` / connection strings / passwords / tokens are **not** stored in this document.

## Git

Dump files are outside `Cartwise`. They did not appear in `git status`. No commit. No push.

## Project after backup

Live database unchanged: migration **0023**, no `substances` table. `0024`–`0029` not applied.

# Full local platform backup report

**Verdict: BACKUP_COMPLETE_WITH_LIMITATIONS**

Date: 2026-08-29
Project: Peptix / Cartwise (`shared-cart-app`)
Local path: `C:\Users\<USERNAME>\Documents\Cartwise`
Backup root: `C:\Users\<USERNAME>\Documents\PEPTIX-BACKUPS\PEPTIX-FULL-BACKUP-2026-08-29`

This backup is **read-only**. No production writes, no migrations, no deploy, no git commit, no git push, no `.env.local` copy.

## Git

| | |
|---|---|
| Repository | yes (`.git` in SOURCE and in the ZIP) |
| Branch | `main` |
| HEAD | `5e38cf1111b1b615703cb7db745e49362425a6f4` (`5e38cf1`) `feat: switch public lexicon to postgres` |
| Prompt expected HEAD | `a6f660d` or later — **actual HEAD takes precedence** (`5e38cf1` is later) |
| Remote | `origin` `https://github.com/<ORG>/Cartwise.git` |
| vs `origin/main` | **ahead by 9 commits** (`origin/main` = `aa26e9f`) |
| Working tree | **dirty** (Block 2–4 and later docs/code uncommitted) |
| Last commit | `5e38cf1` |

The SOURCE copy is the **working tree including uncommitted files**, not HEAD-only.

## Source archive

| | |
|---|---|
| Folder | `SOURCE\` |
| ZIP | `PEPTIX-SOURCE-2026-08-29.zip` |
| ZIP size | 4 736 870 bytes |
| SHA-256 | `62b4031f83a6d448e050e1954038fd4ddddf1bc84afebe61908fcedde2376ace` (re-hashed after ZIP open; match) |
| ZIP entries | 826 |
| Includes `.git/HEAD` | yes |
| Includes `node_modules` | no |
| Includes `.env.local` | no |

Verified by opening the ZIP (listing entries), not by extracting the full tree.

## Database dump

| | |
|---|---|
| Combined dump | `PEPTIX-DATABASE-2026-08-29.sql` (root and `DATABASE\`) |
| Size | 1 761 714 bytes |
| SHA-256 | `ee714e91a87e071feffd996180c6835f14fe0325460f99401a412065199fa415` (re-hashed; match; no `encrypted_password`) |
| Created | 2026-08-29 ~10:38 local |
| Contents | public schema DDL + public `COPY` data |
| Auth rows | **none** (no `auth.users`, no password hashes, no tokens) |

Split parts: `DATABASE\schema.sql` (163 445 bytes), `DATABASE\public-data.sql` (1 597 839 bytes).

Live migration (read-only): **0001–0030** plus `research_operations` version `20260829082116` (= `0031_research_operations.sql`). Prompt expected 0030; live is 0031.

## Database fingerprint (live SELECT, 2026-08-29)

| Metric | Value |
|---|---|
| products | 320 |
| price_sum | 23925 |
| product_fp (`\|` delimiter) | `afd9f04bbf360fb5944709f30d653973` |
| carts | 6 |
| orders | 0 |
| auth.users | 2 |
| substances | 27 |
| sources | 516 (412 approved / 104 review-required) |
| studies | 154 (118 approved / 36 review-required) |
| claims | 294 |
| evidence | 294 (27 approved / 267 review-required) |
| regulatory_records | 41 |
| review_actions | 19 |
| product_substances | 93 |
| research_runs | 2 |
| community_reports | 0 |

`review_status` values use a **hyphen** (`review-required`), not `review_required`. There is **no** `public.prices` table; prices are on `products.price_usd` + `product_price_history`.

## Research cache

Copied existing files only (no network fetch):

- `RESEARCH-CACHE\` ← `src/research/cache/` including `fetched/batch03/` (**66 files**)
- Also inside `SOURCE\src\research\cache\`

## Published research fallback

- `src/lib/peptide/profiles/published.json`
- `src/lib/peptide/catalog.ts`

Present in SOURCE and in the ZIP. Public lexicon is Postgres-primary; these files remain for exclusive full-legacy fallback.

## Documentation

Copied to `DOCUMENTATION\` (**58 files**: PROJECT_STATE, ARCHITECTURE, CHANGELOG, TODO, research phase reports, snapshots). This report is `docs/FULL_LOCAL_BACKUP_REPORT.md` in the working tree and `DOCUMENTATION\FULL_LOCAL_BACKUP_REPORT.md` in the backup. Checksums: `SHA256SUMS.txt`.

## Environment template

`ENVIRONMENT_TEMPLATE.txt` — names only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RESEARCH_DB_MODE`
- `VITE_BASE_PATH`

No values. Never set `service_role` in the client.

## Deployment information

See `DEPLOYMENT_INFO.txt`. Hosted SPA `https://cartwise-zeta.vercel.app`, last documented deployment `dpl_BVpbpXUCKnivEWxhh4gfeU9DwZRe`, served commit `5e38cf1`, Vite `npm run build`, Supabase `cnjrjinvxycdkrmzcime`. **No deploy performed.** Vercel was not re-queried live this backup.

## Restore / Windows

- `RESTORE_GUIDE.md`
- `SETUP_WINDOWS.md` (Node v24.19.0, npm 11.17.0, Docker 29.7.2, Supabase CLI 2.115.0 on the backup PC)
- `DATABASE_RESTORE_WARNING.txt`

## Auth

Documented in `DATABASE\AUTH_NOTES.txt`. Discord + email/password. User count 2. No password/token export. Public `profiles` / `user_roles` UUIDs will not match until those users exist.

## Secret scan

`SECRET_SCAN.txt`. No live secrets copied. Remaining hits are role names (`GRANT … service_role`), docs, and **test fixtures** (`sb_secret_abcdef123456`, fake JWTs with `.signature`). `.env.local` excluded.

## Completeness

See `COMPLETENESS.txt`. Source, migrations 0001–0031, **41** test files, cache, docs, git, fallback files: present. Public research + shop tables: present in the dump.

## Verification gates (working tree, no code changes)

| Gate | Result |
|---|---|
| `npm test` | 486 passed / 40 files |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 `react-refresh/only-export-components` warnings |
| `npm run build` | pass (chunk-size warning) |

## Known limitations

1. **Auth users not dumped.** Restore of `profiles` / `user_roles` / `carts` needs matching `auth.users` UUIDs created separately.
2. **Auth schema / GoTrue keys / Storage objects not dumped.**
3. **Dump not restore-tested** in isolated Docker this run. Circular FKs on `claims` and `research_runs`. Supabase roles required. Never restore onto production.
4. **Working tree is dirty.** ZIP/SOURCE include uncommitted Block 2–4 files; `origin/main` is 9 commits behind local HEAD.
5. **Hosted SPA is still `5e38cf1`.** Durable operations persist lives in the working tree, not on Vercel.
6. **Nested `SOURCE\Cartwise\`** is a stale nested copy; ignore it.
7. **This report is not inside the SOURCE ZIP** (ZIP was sealed before the report). Copies: backup `DOCUMENTATION\` and repo `docs\`.
8. **`user_fp` id-md5 not re-run** this backup (auth id aggregation blocked). Count of 2 confirmed live.
9. **No `public.prices` table** in this schema.

## Production safety

Only `SELECT` / schema dump / `COPY` export. No INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE. No migration apply. No RLS/policy change. No Vercel deploy. No git commit/push.

# Recovery — restore Peptix on another computer or account

Restoration point is **Git `main`**, not a database dump of customers.

- Repository: `https://github.com/kreedqq/Cartwise.git`
- Production SPA: `https://peptix.app`
- Production DB: Supabase **cartwise-prod** (`cnjrjinvxycdkrmzcime`)
- Hosting: Vercel (Vite, `npm run build`, output `dist`, SPA rewrites in `vercel.json`)
- Git branch: `main`

Record the commit SHA you restore from (`git rev-parse HEAD`). The 2026-09-04 recovery documentation commit is listed in [`CHANGELOG.md`](CHANGELOG.md) after it lands.

Offline zip (source only, no secrets, no customer data): see **Backup archive** at the end of this file.

## 1. Clone

```bash
git clone https://github.com/kreedqq/Cartwise.git
cd Cartwise
git checkout main
git log -1 --oneline
```

## 2. Node version

Node.js **22+**. Confirm with `node -v`.

## 3. Dependencies

```bash
npm install
```

Uses `package-lock.json`. Do not delete it.

## 4–5. Environment variables

```bash
cp .env.example .env.local
```

Set **names only from** [`.env.example`](../.env.example) / [`SETUP_NEW_MACHINE.md`](SETUP_NEW_MACHINE.md):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- optional `VITE_RESEARCH_DB_MODE=postgres`

Values: Supabase Dashboard → Settings → API. Same names on Vercel for Production.

**Never** put service_role, Telegram/Discord client secrets, BotFather tokens, or order dumps in `.env.example` or Git.

## 6. Connect Supabase CLI (read-only until history is checked)

```bash
npx supabase login
npx supabase link --project-ref cnjrjinvxycdkrmzcime
npx supabase migration list
```

Compare the remote list to [`PRODUCTION_SCHEMA.md`](PRODUCTION_SCHEMA.md). Local files are `0001`–`0049`; production uses mixed numbered and timestamp versions (`20260904120914` = `0049`, `20260903111826` = `0048`, `20260831123754` = `0040`).

## 7–9. Migrations and schema

- **Existing production:** do nothing. Schema is already live.
- **Brand-new empty project only:** apply `supabase/migrations/` in order on **that** empty project, then seed admin per [`FIRST_ADMIN.md`](FIRST_ADMIN.md).
- Schema-only understanding: migrations + [`PRODUCTION_SCHEMA.md`](PRODUCTION_SCHEMA.md). A data dump is not part of this backup.

### Forbidden on `cartwise-prod`

```bash
# NEVER
supabase db reset --linked
supabase db push          # until migration list is reconciled
```

Do not re-run a migration that already appears in `schema_migrations`. Do not roll migrations backwards.

## 10–12. Auth

Follow [`AUTH_PROVIDERS.md`](AUTH_PROVIDERS.md).

- Site URL: `https://peptix.app`
- Additional redirects: production callback + `http://localhost:5173/auth/callback` for local
- Telegram: Custom OIDC `custom:telegram`, scopes `openid profile`, `origin` query param required
- Discord: provider `discord`, `skipBrowserRedirect`
- Secrets stay in Supabase / BotFather / Discord developer portal

## 13–14. Vercel and domain

- Production domain: `https://peptix.app`
- Build command: `npm run build` (`vercel.json`)
- Output: `dist`
- Framework: Vite SPA, rewrite all non-`assets/` to `index.html`
- Production branch: `main` (GitHub → Vercel)
- Env on Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optional `VITE_RESEARCH_DB_MODE`)

Linking a new Vercel account: import the GitHub repo, set the two public env vars, assign `peptix.app`. Do not copy secret values into Git.

## 15–18. Build and tests

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Do not skip, delete, or disable tests.

## 19. Deployment

Push to `origin/main` if that is the production branch. Confirm the Vercel deployment for `peptix.app` matches the intended commit (`git rev-parse HEAD`).

## 20. Production smoke test

Logged in as admin:

1. `/shop` — peptides Kit labels, oils Vials, orals Packung
2. `/admin/orders` — inbox, status dropdown (`set_order_status`)
3. `/admin/order-summary` — **only `processing`**. Empty when every order is `dispatched` (this is the filter, not a crash).
4. BESTELLUNGEN: complete shared kit → `NameA + NameB | 1 Kit | <dosis> | <artikel>`
5. Geteiltes Kit on the order: each person still `5/10 Kit`
6. PDF export from the same page (same `quantityLabel`)
7. `/admin/users` — roles; `/carts/.../checkout`; `/orders/:id`

## Backup archive

Created beside the working copy (not committed):

See `docs/BACKUP_MANIFEST.md` for filename, size, SHA-256, and Git commit after the zip is built.

The zip contains source, `public/`, `supabase/migrations`, `docs/`, tests, and config. It does **not** contain `.env.local`, service_role, OAuth secrets, API keys, or production row dumps.

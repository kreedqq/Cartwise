# Setup on a new machine

Peptix is a Vite + React SPA. The backend is the existing Supabase project `cartwise-prod` (`cnjrjinvxycdkrmzcime`). Do not create a second production database unless you are deliberately standing up a new environment.

Canonical recovery steps: [`RECOVERY.md`](RECOVERY.md). Auth providers: [`AUTH_PROVIDERS.md`](AUTH_PROVIDERS.md). Schema: [`PRODUCTION_SCHEMA.md`](PRODUCTION_SCHEMA.md).

## Node

Use **Node.js 22+** and npm. Then:

```bash
git clone https://github.com/kreedqq/Cartwise.git
cd Cartwise
npm install
cp .env.example .env.local
```

Fill `.env.local` with **names from this file, values from the dashboards**. Never commit `.env.local`.

## Environment variable names

| Name | Where | Public? | Required |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vite client + Vercel Production/Preview | Yes (project URL) | Yes |
| `VITE_SUPABASE_ANON_KEY` | Vite client + Vercel Production/Preview | Yes (anon / publishable key). Power is RLS. | Yes |
| `VITE_RESEARCH_DB_MODE` | Optional. Default `postgres` | Yes | No |

There are **no other `VITE_` variables** in `src/`. Do not invent `VITE_SUPABASE_SERVICE_ROLE` or put the service-role key in the frontend.

### Where the values come from

- **Supabase Dashboard → Project Settings → API**
  - Project URL → `VITE_SUPABASE_URL` (`https://cnjrjinvxycdkrmzcime.supabase.co`)
  - `anon` / `publishable` key → `VITE_SUPABASE_ANON_KEY`
- **Vercel → Project → Settings → Environment Variables**
  - Same two names for Production (and Preview if you use preview deploys)
  - Values are **build-time** (`import.meta.env`). Changing them requires a new deploy.

### Secret (never in Git, never in `.env.example` values)

| Name / place | Purpose |
|---|---|
| Supabase **service_role** key | Server-only. Edge Functions and Dashboard SQL. Not in `src/`. |
| Telegram Custom OIDC **client secret** | Supabase Auth → Providers → Custom OIDC `custom:telegram` |
| Discord OAuth **client secret** | Supabase Auth → Providers → Discord |
| BotFather bot token | Telegram bot settings. Not used by the SPA directly. |
| Vercel / GitHub tokens | Deployment. |
| Exchange-rate or other Edge Function secrets | Supabase Edge Function secrets. |
| `RESEND_API_KEY` | Tracking-Benachrichtigungen (`send-tracking-email`). Never `VITE_*`. |
| `RESEND_FROM` | Optional From-Header for tracking emails. |
| `SITE_URL` | Optional public origin for the PEPTIX logo in emails. |

`.env.example` keeps empty placeholders only.

## Local run

```bash
npm run dev
```

App: `http://localhost:5173`.

Add that origin to Supabase Auth redirect URLs (see [`AUTH_PROVIDERS.md`](AUTH_PROVIDERS.md)). Production Site URL must stay `https://peptix.app`.

## Quality gates (same as CI)

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Do not

- Commit `.env`, `.env.local`, service-role keys, OAuth secrets, or customer dumps.
- Run `supabase db reset --linked` against `cartwise-prod`.
- Run `supabase db push` on production until `supabase migration list` matches [`PRODUCTION_SCHEMA.md`](PRODUCTION_SCHEMA.md).

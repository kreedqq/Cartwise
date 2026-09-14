# Local isolated QA (E2E via Vitest + local Supabase)

## Prerequisites
- Docker Desktop running
- `supabase start` (local only — never `--linked`)
- Host ports avoid Windows Hyper-V exclusions (see `supabase/config.toml`: 55421+)

## Commands
```bash
supabase start          # local stack only
npm run test:qa         # seed local QA users/data + run integration suite
npm run qa:seed         # seed only
npm test                # unit/component suite (excludes *.qa.test.ts)
```

## Safety
- `scripts/qa/productionGuard.mjs` + `src/lib/qa/productionGuard.ts` abort if URL/ref looks like production (`cnjrjinvxycdkrmzcime`, `cartwise-prod`, `peptix.app`).
- Credentials live in `supabase/qa/.generated/` (gitignored).
- Telegram is not required locally: usernames are set with `username_required_on_next_login=false` (production Telegram gate unchanged).

## Accounts (local only)
| Username | Role | Kit Gesuche |
|---|---|---|
| qa_admin | Group Buy + admin | yes |
| qa_group_buy | Group Buy | yes |
| qa_neu | NEU | no |
| qa_kunde | Kunde | no |
| qa_stammkunde | Stammkunde | no |

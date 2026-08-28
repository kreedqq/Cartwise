# Production Deployment Preflight (Phase 10B)

**Date:** 2026-08-28  
**Verdict:** **DEPLOYMENT_PREFLIGHT_PASS**  
**Release commit:** `a21e838` (`feat: persist research platform and admin workflow`)  
**Not done:** git push, Vercel deploy, Supabase migration, lexicon switch. This document is the Phase 10A.1 docs commit only.

This is a **preflight** only. It does not ship the SPA.

## Git

| Item | Value |
|---|---|
| Branch | `main` (tracks `origin/main`) |
| HEAD | `a21e838` |
| Working tree at audit start | **clean** (ahead 5) |
| This document | recorded in `docs: record deployment preflight` |

## Remote difference (not pushed)

Five local commits on `origin/main..HEAD`:

| Hash | Message | Purpose |
|---|---|---|
| `0da9c90` | chore: backup current peptide platform state | Peptide hub/lexicon/calculator platform backup (166 files). **Only** unpushed commit that touches shop/auth files. |
| `d09a29a` | chore: audit research batch 01 | Batch 01 audit + lexicon detail/tests |
| `837b155` | chore: backup research batch 02 | Batch 02 published overlays + tests |
| `60131c0` | chore: persist research identity phase 1 | `0024` identity + product mapping (SQL already live) |
| `a21e838` | feat: persist research platform and admin workflow | Dual-read, admin Postgres UI, `0025`–`0029` in git, tests, Phase 7–9B docs |

`a21e838` itself does **not** change Shop, Login, cart, orders, or checkout files.

## Vercel

| Item | Value |
|---|---|
| Org / project | `pepsi7` / **`cartwise`** |
| Production deployment (current) | `cartwise-p91omo9n9-pepsi7.vercel.app` (Ready, ~13h before this audit) |
| **Peptix production domain** | **`https://cartwise-zeta.vercel.app`** (alias of that deployment) |
| Other alias of the same deploy | `https://cartwise-pepsi7.vercel.app` (SSO-protected hostname; not the public Peptix URL) |
| **Not Peptix** | `https://cartwise.vercel.app` (generic Vite 404) |
| Build on Vercel | `vercel.json` → `npm run build`, output `dist`, SPA rewrites |

Inspected via CLI against `cartwise-zeta.vercel.app` → project **cartwise**, target **production**.

## Environment (names only)

Vercel Production:

- `VITE_SUPABASE_URL` — set
- `VITE_SUPABASE_ANON_KEY` — set
- `VITE_BASE_PATH` — set
- `VITE_RESEARCH_DB_MODE` — **not set** → client default **`legacy`** (acceptable)

Do not set `postgres` for a lexicon cutover.

Local `.env.local` exists and is **gitignored**. `.env` / `.env.production` absent. Not committed.

## Supabase

| Item | Value |
|---|---|
| Project | **cartwise-prod** (`cnjrjinvxycdkrmzcime`), `ACTIVE_HEALTHY`, only org project |
| Migrations | **0001–0029** (`max_migration` = `0029`) |
| Live counts | 27 substances, 412 sources, 118 studies, 294 claims, 294 evidence, 41 regulatory, 19 review_actions, 93 product_substances |

**Do not re-apply 0024–0029. Do not re-import seeds.**

## Migration safety

| Path | Runs SQL migrations? |
|---|---|
| `vercel.json` `buildCommand` | **No** (`npm run build` only) |
| `package.json` `build` | **No** (`tsc -b && vite build`) |
| GitHub Actions `.github/workflows/deploy.yml` | **No** (npm ci / typecheck / lint / test / Vite build → GitHub Pages) |

No install/postinstall/deploy hook runs `supabase db push` or applies `0024`–`0029`.

**Side effect of a later `git push` to `main`:** the Pages workflow would try to publish GitHub Pages (not the Peptix production host; Pages was 404). Vercel may also build the SPA if Git is linked. Neither applies Postgres. **This preflight does not push.**

## Build / tests (this audit)

| Gate | Result |
|---|---|
| Tests | 399 passed / 32 files |
| Typecheck | pass |
| Lint | 0 errors, 5 existing `react-refresh` warnings |
| Build | pass |

Chunks: `AdminResearch-Bow_nFQ1.js` (~80 kB), `catalog-Bpf148ZI.js` (~348 kB, **published.json** still bundled). Dual-read lives in the admin/research graph.

## Lexicon / admin

- Public lexicon: `catalog.ts` + `published.json`; `lexiconDisplaySource()` always `"legacy"`.
- Admin Research: Postgres primary, paginated queues, append-only `review_actions`, labeled legacy fallback.
- Dual-read: available for admins when `VITE_RESEARCH_DB_MODE` is `dual`/`postgres`; production stays `legacy`.

## Shop / auth

- **`a21e838`:** no shop/auth file changes.
- **`0da9c90` vs `origin/main`:** shop/login/cart/order files differ because origin still lacks the peptide-platform backup. Live Peptix on `cartwise-zeta` already is that lineage. Not a new shop/auth rewrite in Phase 7–8.

## Deployment scope (when later approved)

Ship **SPA only** from `a21e838` (after push or Vercel production deploy). No DB migration, no seed, no research re-import.

Preview (`npx vercel` without `--prod`) was **not** created (would be a real deployment).

## Rollback (do not run now)

| Layer | How |
|---|---|
| Application | Promote/rollback to the current production deployment `cartwise-p91omo9n9-pepsi7.vercel.app` / alias `cartwise-zeta.vercel.app` |
| Database | Emergency only: `Documents\cartwise-prod-backup\cartwise-prod-0023-2026-08-28-full.sql` (**BACKUP_READY_WITH_LIMITATION**). That dump is **pre-research (0023)**. Restoring it would **drop** 0024–0029 research data. **Do not auto-restore.** |

## Browser QA dependency

Phase 9: **BROWSER_QA_PASS_WITH_LIMITATIONS** (no admin session; Phase 8 UI not on Vercel). After a production SPA deploy, run a **new logged-in admin browser QA**.

## Post-deploy checks (later)

Production URL `https://cartwise-zeta.vercel.app`: login, admin research dashboard/queues, claim/evidence/regulatory/source/study/mapping, public lexicon, calculator, shop, cart (no real order), auth/session. Confirm lexicon still files. Confirm no Hudson studies. Confirm no prices in research mapping.

## STOP

No push. No Vercel deploy. No Supabase migration. No lexicon switch. No community. No Batch 03. No commit of this preflight file unless you ask.

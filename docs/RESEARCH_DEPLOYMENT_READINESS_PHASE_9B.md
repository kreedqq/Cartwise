# Deployment Readiness Audit (Phase 9B)

**Date:** 2026-08-28  
**Verdict:** **DEPLOYMENT_READY**  
**Git:** no commit, no push.  
**Deploy:** not performed.  
**Public lexicon:** still `catalog.ts` + `published.json` (`lexiconDisplaySource()` always `"legacy"`).  
**Browser QA:** remains **BROWSER_QA_PASS_WITH_LIMITATIONS** (no admin session; Phase 8 UI **NOT_YET_DEPLOYED**).

This audit prepares the **local working tree** for a later production SPA deploy. It does not deploy.

## Git state

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `60131c0` (*chore: persist research identity phase 1*) |
| Upstream | `origin/main` **ahead 4** (unpushed: `0da9c90`, `d09a29a`, `837b155`, `60131c0`) |
| Staged | none |
| Working tree | dirty: 13 modified + many untracked Phase 2–9 files |

Last backup commit that is on this HEAD: **`60131c0`** (Phase 1 identity, `0024` tracked). Everything below is **after** that commit and is **not** committed.

## Uncommitted changes (classified)

### Database

- Untracked: `supabase/migrations/0025_research_sources_studies_runs.sql` … `0029_research_explicit_product_mappings.sql`
- Modified: `src/types/database.ts` (additive research tables/types: sources, studies, claims, evidence, regulatory, review_actions, …)
- **Already applied** on live `cartwise-prod` (Phase 6C). Committing them is git/history parity, **not** a new migration apply.

### Dual Read (Phase 7)

- `src/lib/peptide/persistence/researchDbMode.ts` (modified; default `legacy`)
- `src/lib/peptide/persistence/dualRead/*` (untracked)
- `src/hooks/useDualRead.ts`, `src/components/admin/DualReadDebug.tsx`
- `src/lib/peptide/search.ts` (search haystack: name / displayName / aliases / developmentNames / slug / CAS only)
- `src/lib/peptide/lexiconFilters.ts` + `src/pages/peptide/PeptideLexicon.tsx` (status filter still on **file** catalog overlays)
- Tests: `src/tests/researchDualReadPhase7.test.ts`

### Admin / Research (Phase 8)

- `src/pages/admin/AdminResearch.tsx` (Postgres dashboard, paginated queues, review actions, mapping without prices)
- `src/lib/peptide/adminResearch/*`, `src/services/adminResearch.ts`, `src/hooks/useAdminResearch.ts`
- `src/lib/constants.ts` (query keys only)
- Tests: `src/tests/researchAdminPostgresPhase8.test.ts`

### Research (seeds / mapping helpers, not new science)

- `publishedScienceSeed.ts`, `publishedClaimsSeed.ts`, `publishedRegulatorySeed.ts`, `identifiers.ts`, `sqlProductMapping.ts`, `explicitProductMappings.ts`, `researchReadiness.ts`
- `liveShopProducts.ts` — **read-only** `{code,name}` snapshot (320 SKUs, **no prices**); used by dual-read compare, not shop writes
- Scripts: `scripts/generate-phase2-sql.mjs` … `phase4`

### Tests

- Phase 2–5, 6A, 6B, 7, 8 test files (existing tests not deleted)

### Documentation

- Phase 2–9 docs, apply/backup/fixes/readiness, PROJECT_STATE / ARCHITECTURE / CHANGELOG / TODO
- `docs/RESEARCH_PERSISTENCE_ARCHITECTURE.md` — status line only (phases 1–4 exist; lexicon switch still not started)

### Configuration

- `.env.example` — comments for `VITE_RESEARCH_DB_MODE` (`legacy` \| `dual` \| `postgres`); **placeholder values only**
- `.gitignore` — ignore `.local-backups/`

### Lexikon

- Public read path **unchanged** (catalog + published.json). Search/filter helpers only. **No switch.**

### Shop / Auth

- **No diffs** in `App.tsx` routes, Login/Register, `AuthProvider`, shop/cart/order pages or shop RPCs, or migrations `0001`–`0023`.

### Unrelated

- None that change product behavior. Nested `Cartwise/` gitlink (if present) must **not** be committed.

## Secrets

| Check | Result |
|---|---|
| `.env` / `.env.production` | absent |
| `.env.local` | **present locally**, **gitignored** (`.env.*`) |
| `.env.example` | names + placeholders only (`your-anon-key`, example URL) |
| `src/` | no `service_role` client key; dual-read logger redacts token-like strings |
| Recommended commit | **exclude** `.env.local`, credentials, `.vercel` |

Environment **names** in example/docs: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_RESEARCH_DB_MODE`.

## Phase 7 verification

| Item | Status |
|---|---|
| Dual-read implementation | Present; admin-only fetch when mode is `dual` or `postgres` |
| Legacy display | `lexiconDisplaySource()` hardcoded `"legacy"` |
| Normalizer + compare | `dualRead/normalizeLegacy.ts`, `normalizePostgres.ts`, `compare.ts` |
| Search / filter parity | Spec fields only; identity-note not searched (TB-500 ↛ TB4) |
| Claim / evidence / regulatory / mapping compare | In Phase 7 tests |
| Hudson exclusion | `HUDSON_NCTS`; compare family `hudson` |
| Production default | **`legacy`** — not changed |

## Phase 8 verification

| Item | Status |
|---|---|
| Postgres primary for Admin Research | `fetchAdminResearchDashboard` / queues |
| Review queue | evidence / regulatory / claim / substance; page size 20 |
| Review actions | INSERT `review_actions` then entity UPDATE; `edit` not in UI |
| Append-only | no UPDATE/DELETE on `review_actions` |
| RLS | existing `has_role(..., 'admin')`; 0028 admin sees all evidence |
| Pagination / errors / labeled legacy fallback | implemented |
| Product mapping | `products(code, name)` only |
| Hosted SPA | **NOT_YET_DEPLOYED** |

## Public lexicon safety

`PeptideLexicon.tsx` → `catalog` + `searchSubstances`.  
`PeptideLexiconDetail.tsx` → `getSubstanceBySlug` + `getPublishedProfile`.  
`App.tsx` peptide routes unchanged.

## Shop safety

No uncommitted changes to products/prices/cart/orders/checkout services or shop migrations. Research mapping does not write shop tables. `liveShopProducts.ts` is a static code/name list.

## Auth safety

No uncommitted changes to login, register, session, roles, Discord, Magic Link, or `has_role` SQL. `useDualRead` / `useSubmitAdminReview` **read** `useAuth().isAdmin` only.

## Environment

| Name | Local code | Vercel Production (names only) |
|---|---|---|
| `VITE_SUPABASE_URL` | required | set |
| `VITE_SUPABASE_ANON_KEY` | required | set |
| `VITE_BASE_PATH` | optional | set |
| `VITE_RESEARCH_DB_MODE` | default **`legacy`** | **not set** → client default `legacy` |

**Keep production unset or `legacy`.** Do not set `postgres` for a public lexicon switch. Admin Research uses Postgres **queries** regardless of this flag.

## Build / tests / bundle

Local gates (2026-08-28, this audit):

| Gate | Result |
|---|---|
| `npm test` | 399 passed / 32 files |
| Typecheck | pass |
| Lint | 0 errors, 5 existing `react-refresh` warnings |
| `npm run build` | pass |

Bundle includes:

- `AdminResearch-*.js` (~80 kB) — Phase 8 admin + dual-read debug
- `catalog-*.js` (~348 kB) — **published.json still bundled** (required for legacy lexicon)
- Search / dual-read / admin research in the graph

## Routes

Unchanged in `App.tsx`: `/peptide`, `/peptide/rechner`, `/peptide/lexikon`, `/peptide/lexikon/:slug`, `/admin/research` (nested `research` under `/admin`), `/shop`, `/orders`. There is **no** `/cart` route; carts remain `/carts/:cartId`.

## Database compatibility

Code targets live schema **0024–0029** already on `cartwise-prod`:

`substances`, `sources`, `studies`, `claims`, `claim_sources`, `evidence_assessments`, `regulatory_records`, `review_actions`, `product_substances` (+ `products.code/name` for mapping).

No `research_updates` table — admin shows 0, does not invent rows.  
**Do not** `db push` / re-apply 0025–0029 on production. Frontend deploy only.

## Vercel difference

Hosted Peptix: `https://cartwise-zeta.vercel.app` (`index-3Jxwuqf6.js`). Local production build: `index-3RL5K1Es.js` + `AdminResearch-Bow_nFQ1.js`.

**Not on Vercel yet:** Phase 7 dual-read + search haystack fix, Phase 8 Admin Postgres UI, related tests/docs.

`https://cartwise.vercel.app` is **not** this SPA (Vite 404).

## Browser QA limitation

Phase 9: **BROWSER_QA_PASS_WITH_LIMITATIONS**. Logged-in admin/lexicon/shop were not exercised (no session). That is **not** a full browser PASS.

## Deployment risks

1. Deploying the SPA will turn on Admin Research **Postgres reads/writes** for admins; public lexicon stays files.
2. Re-running research migrations on prod would be unsafe (already applied).
3. Setting `VITE_RESEARCH_DB_MODE=postgres` is **not** required and must **not** be used as a lexicon switch.
4. Four local commits are still unpushed; a Vercel git deploy from `origin/main` would miss even Phase 1 client commit until push (when asked).
5. Logged-in production QA still outstanding after deploy.

## Recommended commit scope (when you ask)

**Include:** `src/lib/peptide/**` (admin + dual-read + seeds + search/filters), `src/pages/admin/AdminResearch.tsx`, `src/pages/peptide/PeptideLexicon.tsx`, hooks/services/constants/types, `src/tests/research*.test.ts`, `supabase/migrations/0025`–`0029`, `scripts/generate-phase*.mjs`, `.env.example`, `.gitignore`, `docs/*` for phases 2–9B.

**Exclude:** `.env.local`, `.vercel`, nested `Cartwise/`, backup SQL dumps, credentials.

Suggested message theme: persist research phases 2–8 client + dual-read + admin Postgres UI; lexicon remains files; migrations 0025–0029 already live.

## STOP

No commit. No push. No deploy. No lexicon switch. No community. No Batch 03.

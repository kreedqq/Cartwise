# UI Crash Fix Deploy (Phase 10E)

**Date:** 2026-08-29  
**Verdict:** **UI_FIX_DEPLOYED_AND_VERIFIED**  
**Git:** local commit only. **No push.**

## Commit

| Item | Value |
|---|---|
| Hash | `b079bbf` |
| Message | `fix: resolve asChild button slot crash` |
| Parent | `baaa335` |
| Branch | `main` (ahead of `origin/main` by **7**) |
| Working tree after commit | clean |

Files in the commit: `src/components/ui/button.tsx`, `src/tests/button.test.tsx`, Phase 10C/10D/admin-QA docs, `ARCHITECTURE` / `CHANGELOG` / `PROJECT_STATE` / `TODO`. No shop, cart, order, checkout, auth, or migration files.

## Pre-deploy gates

| Gate | Result |
|---|---|
| `npm test` | **409** passed |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors (5 pre-existing react-refresh warnings) |
| `npm run build` | pass; chunk `button-Dq-9OMxe.js` |

## Local browser (before deploy)

Preview `http://127.0.0.1:4173` with existing admin session:

| Route | Result |
|---|---|
| `/403` | asChild Link renders |
| unknown URL | 404 asChild Link renders |
| `/peptide/lexikon/retatrutide` | Profile + Scientific Evidence, no Slot crash |
| `/peptide/lexikon/tirzepatide` | Same |
| `/peptide/lexikon/semaglutide` | Same |
| `/peptide/rechner` | Four tabs; Link “Zum Lexikon” |

## Deployment

| Item | Value |
|---|---|
| Vercel org / project | `pepsi7` / `cartwise` |
| Command | `npx vercel --prod --yes` |
| Remote build | `tsc -b && vite build` only (no `supabase db push`) |
| Deployment id | `dpl_BTukrYBjxY1rAURuznPqgBhMxbHn` |
| Deployment URL | `https://cartwise-g2hs39olb-pepsi7.vercel.app` |
| **Production alias** | **`https://cartwise-zeta.vercel.app`** |
| Ready | 2026-08-29 ~00:29 local (UTC+2) |
| Previous production (SPA rollback) | `dpl_14mm8BqoLzA9NG4CUmyDiWcGWAh1` (`cartwise-kkl57nrul-pepsi7.vercel.app`) |
| Main bundle | `index-Cu9MiRQQ.js` |
| Button chunk | `button-Dq-9OMxe.js` (replaces `button-C9NJmCLl.js`) |

Not used: `https://cartwise.vercel.app`.

## Environment / database

`VITE_RESEARCH_DB_MODE` unchanged (unset → **legacy**). Public lexicon still `catalog.ts` + `published.json`.

Live `cartwise-prod` migrations still **0001–0029**. No 0024–0029 re-apply.

| Table | Count |
|---|---|
| substances | 27 |
| sources | 412 |
| studies | 118 |
| claims | 294 |
| evidence_assessments | 294 |
| regulatory_records | 41 |
| review_actions | 19 |
| product_substances | 93 |

## Production browser QA (logged-in admin session)

No logout. No review actions. No orders.

| Check | Result |
|---|---|
| `/` | Redirects to dashboard; session + Admin nav |
| `/login` | Login form renders (session kept; not submitted) |
| `/shop` | Four catalog groups (165 / 51 / 79 / 3) |
| `/peptide` | Hub |
| `/peptide/lexikon` | `27 von 27 Profilen · keine Shoppreise` |
| `/peptide/lexikon/retatrutide` | Detail + Overview/Evidence; **no crash** |
| `/peptide/lexikon/tirzepatide` | Detail; **no crash** |
| `/peptide/lexikon/semaglutide` | Detail; **no crash** |
| `/peptide/rechner` | Rekonstitution / Konzentration / Einheiten / Vial; **no crash** |
| `/admin/research` | Postgres; 412 / 118 / 294 / 267 evidence review |
| Cart | Existing 1-line cart; not mutated |
| Console | No `Slot failed to slot onto its children`; sampled assets no 404/500 |

## Auth / shop / lexicon

Auth and shop code were not in the commit. Session and admin access still work. Public lexicon remains legacy files.

## Known limitations

- This documentation file is **not** in `b079bbf` (written after deploy; do not auto-commit).
- Commit was **not** pushed.
- Dual-read / public Postgres lexicon / Batch 03 / community were not started.

## STOP

No push. No lexicon switch. No Batch 03. No community. No new migration.

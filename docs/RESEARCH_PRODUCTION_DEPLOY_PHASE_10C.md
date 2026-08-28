# Production SPA Deploy (Phase 10C)

**Date:** 2026-08-28  
**Verdict:** **PRODUCTION_DEPLOY_SUCCESS_WITH_QA_LIMITATION**  
**Git:** no additional commit, no push.

## Release

| Item | Value |
|---|---|
| HEAD at deploy | `baaa335` (`docs: record deployment preflight`) |
| Application release | `a21e838` (`feat: persist research platform and admin workflow`) |
| Diff `a21e838..baaa335` | docs only |
| Working tree | clean |

## Deployment

| Item | Value |
|---|---|
| Vercel org / project | `pepsi7` / `cartwise` |
| Command | `npx vercel --prod --yes` (SPA only; `npm run build`) |
| Deployment id | `dpl_14mm8BqoLzA9NG4CUmyDiWcGWAh1` |
| Deployment URL | `https://cartwise-kkl57nrul-pepsi7.vercel.app` |
| **Production alias** | **`https://cartwise-zeta.vercel.app`** |
| Ready | 2026-08-28 ~23:51 local (UTC+2) |
| Previous production (rollback SPA) | `cartwise-p91omo9n9-pepsi7.vercel.app` (`dpl_MQydYVC5jxL8ZNcp99HvwhvJGasD`) |
| Not used | `https://cartwise.vercel.app` |

Vercel build ran `tsc -b && vite build` only. No `supabase db push`, no seed, no research import.

## Environment

`VITE_RESEARCH_DB_MODE` still **unset** → code default **legacy**. Not set to `postgres` or `dual`.

## Database (unchanged)

| Item | After deploy |
|---|---|
| Project | cartwise-prod `cnjrjinvxycdkrmzcime` |
| Max migration | **0029** |
| substances / sources / studies | 27 / 412 / 118 |
| claims / evidence | 294 / 294 |
| regulatory / review_actions / product_substances | 41 / 19 / 93 |

## Lexikon / admin / shop / auth

- Public lexicon: still `catalog.ts` + `published.json` (catalog chunk `catalog-Bpf148ZI.js`, 348285 bytes).
- Admin Research chunk live: `AdminResearch-DAuxC1ra.js` (HTTP 200, ~81 kB).
- Main bundle: `index-CoeZiILn.js`; host `cnjrjinvxycdkrmzcime.supabase.co` present (no keys copied).
- Shop/auth: no DB or RLS changes from this deploy.

## Browser checks (no session)

| Route | Result |
|---|---|
| `GET /` | 200 → login |
| `/login` | Peptix Passwort / Magic Link / Discord |
| `/register` | form renders |
| `/forgot-password` | form renders (not submitted) |
| `/shop` | redirects to `/login` |
| `/peptide`, `/peptide/lexikon`, `/peptide/rechner` | **NOT TESTED** logged-in (no session) |
| `/admin/research` | **NOT TESTED** (no admin session) |

Login assets: JS/CSS/`peptix-brand.jpg` **200**. No 404/500 on those. No unhandled overlay. No secrets in logs.

## Known limitations

- Logged-in admin research, lexicon, calculator, shop, and cart were **not** exercised (no session).
- After this deploy, a dedicated logged-in admin QA is still required.
- Do **not** restore the 0023 SQL dump as an app rollback (would wipe 0024–0029). SPA rollback = previous Vercel deployment above.

## STOP

No lexicon switch. No Batch 03. No community. No commit. No push.

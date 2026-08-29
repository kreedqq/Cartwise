# Phase 12 — Production post-cutover audit

**Date:** 2026-08-29  
**Verdict:** **PRODUCTION_POST_CUTOVER_PASS_WITH_LIMITATIONS**  
**Scope:** Read-only. **No** commit, push, deploy, migration, seed, import, review action, cart mutation, or order.

Code is the source of truth. This audit checked live `https://cartwise-zeta.vercel.app` plus `src/` and read-only `cartwise-prod`.

## Production

| Item | Value |
|---|---|
| Vercel project | `pepsi7/cartwise` |
| **Production URL** | **https://cartwise-zeta.vercel.app** |
| Unused | `https://cartwise.vercel.app` (not requested for this audit; not used) |
| Database | `cartwise-prod` (`cnjrjinvxycdkrmzcime`) |
| HTML | `index-DUZqm_Lt.js`, `index-BPhEo9i0.css`, `button-Dq-9OMxe.js` (Phase 10E Slot fix retained) |

## Deployment

Active production alias still serves Phase 11C (`dpl_BVpbpXUCKnivEWxhh4gfeU9DwZRe`). SPA-only. No new deploy in this phase.

## Commit

| Item | Value |
|---|---|
| HEAD | `5e38cf1111b1b615703cb7db745e49362425a6f4` |
| Message | `feat: switch public lexicon to postgres` |
| Branch | `main` tracks `origin/main`, **ahead 9** |
| Working tree | dirty **docs only** (11C + this audit). App source matches HEAD. |

## Database

Read-only counts vs pre-cutover / Phase 11C fingerprint:

| Table | Expected | Actual |
|---|---|---|
| substances | 27 | 27 |
| sources | 412 | 412 |
| studies | 118 | 118 |
| claims | 294 | 294 (all `approved`; 0 draft / 0 rejected) |
| evidence_assessments | 294 | 294 (27 approved / 267 review-required) |
| regulatory_records | 41 | 41 (39 approved+current / 2 review-required) |
| review_actions | 19 | 19 |
| product_substances | 93 | 93 |
| products | 320 | 320 |
| orders | 0 | 0 |
| carts | “2 active” | 2 `draft`, 1 `ready`, 3 `ordered` (6 total) |

The “2 active carts” label is **draft** carts, not a `status=active` column. Documented, not changed.

Hudson NCTs in `studies`: **0**. Hudson in `sources.nct_id`: **0**. Raw cache may still mention Hudson (`src/research/cache/fetched/melanotan-ii.json`). Allowed.

Approved claims without `claim_sources`: **0**.

## Migration

Latest live: **0029**. `0001`–`0029` present. Not re-applied.

## Lexicon mode

`VITE_RESEARCH_DB_MODE` unset on Vercel → code default **`postgres`**. Emergency rollback: `legacy`. Files `catalog.ts` + `published.json` remain exclusive fallback. Not removed.

## Postgres

Public UI: `usePublicLexicon` → `resolvePublicLexicon` → `fetchPublicLexicon` (parallel REST SELECTs). Network on `/peptide/lexikon`:

- `substances`, `substance_aliases`, `substance_components`
- `claims?status=eq.approved`
- `claim_sources`
- `evidence_assessments?review_status=eq.approved`
- `sources`, `source_substances`, `studies`, `study_substances`
- `regulatory_records`

No `review_actions` on the public path. Shop RPC `list_shop_products` is unrelated shop mapping.

## Fallback

| Environment | Result |
|---|---|
| Unit tests (`failingPublicSelectClient` timeout / rls / network / query; incomplete bundle) | Exclusive full legacy catalog, 27 substances, no mixed fields |
| Production outage simulation | **NOT TESTED** (no production DB/network sabotage) |

## Public visibility / evidence / claims / regulatory

Public mapper + query filters: draft / review-required / rejected hidden. Public evidence overlays are the **27 approved** A–F rows. The **267 review-required** rows appear on **admin** Evidence Review (`267 Einträge`) and **not** on public Retatrutide (no Review Required section).

Orforglipron public + SQL: FDA, **US**, `approved_specific_indication`, product **FOUNDAYO (ORFORGLIPRON)**, **NDA220934**, current + approved. Retatrutide SQL + list: **`clinical_development`**, not global Approved.

## Hudson

Search `NCT07487363` and `NCT07437560`: **0 von 27**. Absent from Retatrutide body.

## Identity

Separate substances and identity notes in Postgres. List/search: TB-500 search does **not** return Thymosin Beta-4 (Glow Blend may appear as blend containing TB-500). Thymosin Beta-4 search is itself only. Glow is `molecule_type=blend`. Melanotan II / IGF-1 LR3 notes deny auto-merge with Afamelanotide / Mecasermin.

## Search / filters / details / calculator

See test table below. Nine required detail routes loaded without Slot crash. Calculator four tabs; units g/mg/mcg/ng + ml; IU not estimated; framed as mathematical result.

## Admin / RLS / API

Admin dashboard (existing session, **no Approve/Reject**): Sources 412, Studies 118, Claims 294, Evidence Review 267, Regulatory Review 2, review_actions page “19 Einträge · Postgres”. Dual Read mode **postgres**, **critical 0**, stale copy still says lexicon is file-based.

RLS (live policies):

- `claims` SELECT: authenticated and (`status=approved` **or** admin)
- `evidence_assessments` SELECT: authenticated and (admin **or** approved assessment on approved claim) — 0028
- `regulatory_records` SELECT: authenticated and (admin **or** current+approved)
- `review_actions` SELECT: **admin only**

Unauthenticated users: peptide routes behind `ProtectedRoute`; RLS also requires `auth.uid() IS NOT NULL`. Live anon-key REST without a session was **not** executed (no secret dump).

Public lexicon responses: no `review_actions`, no `published.json` HTTP. Admin page **did** request `review_actions` (expected).

## Shop / auth / navigation / console / network / performance / mobile

Shop four groups unchanged; cart badge 1 item; no order. Session **pepsidryage** kept. Dashboard / shop / orders / peptide / lexicon / admin links work. No Slot overlay. Catalog JS (~348 kB) still ships for fallback; primary science is REST. Mobile 390×844: bottom nav **Lexikon**, search/filters still usable.

## Tests / build

| Gate | Result |
|---|---|
| `npm test` | 426 passed / 34 files |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 pre-existing react-refresh warnings |
| `npm run build` | pass |

## Test table

| Test | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| Production deploy | 11C SPA on zeta | `index-DUZqm_Lt.js` live | PASS | No new deploy |
| HEAD = 5e38cf1 | cutover commit | `5e38cf1` | PASS | ahead 9 of origin |
| Working tree | app clean | docs dirty | PASS | expected; not committed |
| Migration 0029 | unchanged | max 0029 | PASS | no apply |
| Research counts | 27/412/118/294/294/41/19/93 | match | PASS | |
| Shop counts | 320 products, 0 orders | match | PASS | |
| Carts | 2 active | 2 draft (+1 ready, 3 ordered) | PASS | label difference only |
| Lexicon mode postgres | unset → postgres | code default postgres | PASS | |
| Postgres primary (network) | REST research tables | listed above; `status=eq.approved`; `review_status=eq.approved` | PASS | |
| published.json not primary | no HTTP published.json | none | PASS | fallback chunk still bundled |
| Public review_actions | none | 0 on lexicon | PASS | |
| Admin review_actions | allowed | 3 requests on `/admin/research` | PASS | |
| Exclusive fallback (unit) | full legacy | Phase 11 tests | PASS | |
| Exclusive fallback (prod) | full legacy | not simulated | NOT TESTED | no prod outage |
| Public claims approved+sourced | no orphans | 0 unsourced approved | PASS | PMID markers on Retatrutide |
| 27 public evidence | A–F overlays | list Evidence A–F; Retatrutide B | PASS | |
| 267 review-required hidden | not public | hidden on detail; 267 on admin | PASS | |
| Draft/rejected public | hidden | 0 draft/rejected claims | PASS | |
| Orforglipron FOUNDAYO/NDA/US | specific indication | FOUNDAYO, NDA220934, US | PASS | |
| Retatrutide clinical_development | not global Approved | Clinical development | PASS | |
| Hudson NCTs | 0 public | 0 search + 0 studies | PASS | cache file may mention NCT |
| TB-500 ≠ TB4 | separate | separate cards/search | PASS | |
| Melanotan II ≠ Afamelanotide | separate | identity note | PASS | |
| IGF-1 LR3 ≠ Mecasermin | separate | identity note | PASS | |
| Glow = blend | blend | `molecule_type=blend` | PASS | |
| Search Reta / LY3437943 | Retatrutide | 1 hit | PASS | |
| Search Tirze / Tirzepatide | Tirzepatide | Tirze → 1 | PASS | |
| Search Semax / Selank / MOTS-c | self | 1 each | PASS | |
| Search TB-500 | not TB4 | TB-500 + Glow blend | PASS | |
| Search Thymosin Beta-4 | self | 1 | PASS | |
| Category + status filters | chips remain; filter works | GLP 8/27; GLP+Clinical Trial 3/27 | PASS | empty-category chips still shown |
| Detail 9 routes | no crash | all loaded | PASS | Slot not present |
| Calculator 4 tabs | math only | all tabs; IU not estimated | PASS | |
| Admin dashboard counts | 412/118/294/267/2/93 | match | PASS | Dual Read copy stale |
| Product Mapping tab | codes, no prices | SQL 93; 11C UI; this audit dashboard only | PASS | tab body not re-clicked |
| Shop read-only | 4 groups | 165/51/79/3 | PASS | no cart write |
| Auth session | stay logged in | pepsidryage admin | PASS | no logout |
| Navigation | no broken links | dashboard/shop/orders/peptide/lexikon/admin | PASS | |
| Console Slot crash | absent | absent | PASS | no persistent log dump |
| RLS policies | public approved only | 0028/0026/0027 as live | PASS | anon REST live call NOT TESTED |
| Performance | no full DB dump | selective REST + 348 kB fallback chunk | PASS | |
| Mobile 390×844 | nav + lexicon | bottom Lexikon; list usable | PASS | calculator on mobile not re-tabbed |
| Dual-read parity | no critical diffs | DUAL_READ_READY critical 0 | PASS | |
| Tests/typecheck/lint/build | green | 426 / pass / 0 err / pass | PASS | |
| Community | unavailable | Community Updates 0; connectors stub | PASS | not activated |
| Batch 03 | not started | not started | PASS | |

## Known issues

1. Exclusive **legacy fallback NOT TESTED** against live production (safe: unit tests only).
2. Admin Dual Read still prints “Lexikon bleibt Legacy” while Mode is `postgres` (`DualReadDebug.tsx`).
3. Fallback catalog JS (~348 kB) still ships; expected until fallback is retired (not this phase).
4. Cart interior / checkout not opened (read-only).
5. Unauthenticated REST with anon JWT not live-probed (policy + ProtectedRoute reviewed).
6. Git working tree dirty with documentation only.

## STOP

No Batch 03. No community. No commit. No push. No deploy. No database change.

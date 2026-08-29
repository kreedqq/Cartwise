# Phase 11C — Production public lexicon Postgres cutover

**Date:** 2026-08-29  
**Verdict:** **PRODUCTION_LEXICON_CUTOVER_SUCCESS_WITH_LIMITATIONS**  
**Git:** documentation only. **No commit. No push.**

SPA-only deploy of commit `5e38cf1`. Production database was **not** migrated, seeded, imported, reset, or otherwise written.

## Deployment

| Item | Value |
|---|---|
| Vercel org / project | `pepsi7` / `cartwise` |
| Command | `npx vercel --prod --yes` (application / SPA only) |
| Remote build | `tsc -b && vite build` only — no `supabase db push` |
| Deployment id | `dpl_BVpbpXUCKnivEWxhh4gfeU9DwZRe` |
| Deployment URL | `https://cartwise-6b69j1zii-pepsi7.vercel.app` |
| Inspect | `https://vercel.com/pepsi7/cartwise/BVpbpXUCKnivEWxhh4gfeU9DwZRe` |
| **Production alias** | **`https://cartwise-zeta.vercel.app`** |
| Ready | 2026-08-28 ~23:17 UTC (`Last-Modified` on HTML) |
| Previous production (SPA rollback) | `dpl_BTukrYBjxY1rAURuznPqgBhMxbHn` (`cartwise-g2hs39olb-pepsi7.vercel.app`, Phase 10E Slot fix) |
| Not used | `https://cartwise.vercel.app` |

`GET https://cartwise-zeta.vercel.app/` → **HTTP 200**, `text/html`, Vercel HIT.

## Commit

| Item | Value |
|---|---|
| HEAD at deploy | `5e38cf1111b1b615703cb7db745e49362425a6f4` |
| Message | `feat: switch public lexicon to postgres` |
| Parents | `a6f660d` (`docs: document production ui fix deployment`) |
| Working tree at deploy | **CLEAN** |

Local pre-deploy build: **pass**. Tests/typecheck/lint were already green on this commit (426 / pass / 0 errors).

## Production URL

**https://cartwise-zeta.vercel.app** (Peptix). Do not use `https://cartwise.vercel.app`.

Hosted assets (this deploy):

| Asset | Notes |
|---|---|
| `index-DUZqm_Lt.js` | main SPA |
| `index-BPhEo9i0.css` | CSS **200** |
| `button-Dq-9OMxe.js` | Phase 10E Slot fix retained |
| `usePublicLexicon-C6Vn5jFJ.js` | public lexicon hook; no `review_actions` fetch |
| `PeptideLexiconDetail-G96_2VMH.js` | detail chunk |
| `publishedScienceSeed-C8X2UKBP.js` | bundled exclusive-fallback science (not a `published.json` HTTP fetch) |

## Environment

| Variable | Production |
|---|---|
| `VITE_SUPABASE_URL` | set (name only in this report) |
| `VITE_SUPABASE_ANON_KEY` | set (name only) |
| `VITE_RESEARCH_DB_MODE` | **unset** |

Unset → code default **`postgres`**. Not `legacy`. Emergency rollback remains `VITE_RESEARCH_DB_MODE=legacy` (SPA env + redeploy). Do **not** restore the 0023 SQL dump as application rollback.

## Database

| Item | Value |
|---|---|
| Project | `cartwise-prod` (`cnjrjinvxycdkrmzcime`) |
| This deploy | **no schema change, no seed, no import, no reset, no push** |

## Migration

Live `supabase_migrations.schema_migrations`: **0001–0029**. Latest **0029** (`research_explicit_product_mappings`). 0024–0029 were **not** re-applied.

## Lexicon mode

Public lexicon: **Postgres primary**, exclusive full-legacy fallback on timeout / network / RLS / query / invalid / incomplete bundle.

Admin Dual Read panel (cosmetic): still prints “Lexikon bleibt Legacy … Mode: postgres”. Public UI is Postgres; that sentence is stale copy from Phase 8. See Known limitations.

## Postgres read

Browser `performance` resource list on lexicon/detail included:

- `rest/v1/substances`
- `rest/v1/substance_aliases`
- `rest/v1/substance_components`
- `rest/v1/claims?...&status=eq.approved`
- `rest/v1/claim_sources`
- `rest/v1/evidence_assessments?...&review_status=eq.approved`
- `rest/v1/sources`
- `rest/v1/source_substances`
- `rest/v1/studies` / `study_substances`
- `rest/v1/regulatory_records`

No `review_actions` request on the public path. Shop RPC `list_shop_products` still used for SKU mapping (codes only; no prices on lexicon).

## Legacy fallback

**NOT TESTED** in production. A forced Postgres failure was not simulated (would risk disturbing production or mixing test traffic). Code path remains exclusive full-legacy response; no mixed Postgres+legacy fields on one request (covered by Phase 11 unit tests).

## Search

Logged-in session. List: **27 von 27 Profilen · keine Shoppreise**. Category and status filters present.

| Query | Result |
|---|---|
| Reta | 1 — Retatrutide |
| Retatrutide | identity card present (aliases include Reta · LY3437943) |
| LY3437943 | 1 — Retatrutide |
| Tirze | 1 — Tirzepatide |
| Tirzepatide | identity card present |
| Semax | 1 — Semax |
| Selank | 1 — Selank |
| MOTS-c | 1 — MOTS-C |
| TB-500 | TB-500 (+ Glow Blend as blend containing TB-500; **not** Thymosin Beta-4) |
| Thymosin Beta-4 | 1 — Thymosin Beta-4 |
| NCT07487363 | **0 von 27** |
| NCT07437560 | **0 von 27** |

## Filters

Category chips (Peptides, GLP / Metabolic, …) and status chips (Approved, Clinical Trial, …) render. Retatrutide list status: **Clinical development · Evidence B**. Orforglipron: **Approved for specific indication · Evidence A**. No shop prices on cards.

## Details

No crash. Slot error did not appear. Sections present on Retatrutide: Overview, Mechanism, Effects, Safety, Interactions, Reconstitution, Clinical Trials, Scientific Evidence, Sources.

| Path | Result |
|---|---|
| `/peptide/lexikon/retatrutide` | loads; last research scan “—” (Postgres path) |
| `/peptide/lexikon/tirzepatide` | loads |
| `/peptide/lexikon/semaglutide` | loads |
| `/peptide/lexikon/orforglipron` | loads |
| `/peptide/lexikon/tb-500` | loads |
| `/peptide/lexikon/thymosin-beta-4` | loads |
| `/peptide/lexikon/melanotan-ii` | loads |
| `/peptide/lexikon/igf-1-lr3` | loads |
| `/peptide/lexikon/glow-blend` | loads; display name blend `GHK-Cu + TB-500 + BPC-157` |

## Claims

Public claims render with inline source markers (e.g. `[ PMID 37366315 ]`). Claims query used `status=eq.approved`.

## Evidence

Public evidence query used `review_status=eq.approved`. Retatrutide public page: **no** “Review Required” evidence section. Admin Evidence Review: **267 Einträge · Seite 1 · Postgres** (admin-only). Those 267 did **not** appear on the public Retatrutide profile.

## Regulatory

Orforglipron public detail: **FOUNDAYO**, **NDA220934**, **US**, status **Approved for specific indication** (not a global unlabeled “Approved”). Retatrutide: **Clinical development**; no global Approved claim. Hudson NCTs absent from Retatrutide NCT list.

## Sources

Retatrutide Sources: ClinicalTrials.gov search, openFDA no-product-match, NCT rows, PubMed PMIDs (e.g. 37366315, 37385280, 42250575).

## Studies

Retatrutide Clinical Trials list includes NCT05882045, NCT05929066, NCT06354660, NCT06383390, … — **not** NCT07487363 / NCT07437560.

## Hudson

| NCT | Public lexicon search | Public Retatrutide body |
|---|---|---|
| NCT07487363 | 0 von 27 | absent |
| NCT07437560 | 0 von 27 | absent |

## Identity

| Check | Result |
|---|---|
| TB-500 ≠ Thymosin Beta-4 | Separate cards and detail slugs |
| Melanotan II ≠ Afamelanotide | Melanotan II page did not merge into Afamelanotide |
| IGF-1 LR3 ≠ Mecasermin | Own slug/card; Mecasermin is not a merged identity |
| Glow Blend = Blend | List alias Glow Blend · GLOW; detail heading is the three-component blend |

## Calculator

`/peptide/rechner`: Rekonstitution, Konzentration, Einheiten, Vial all switch and compute. No Slot crash. “Zum Lexikon” link present.

## Admin

`/admin/research` with existing admin session (**no logout**, **no Approve/Reject**):

| Surface | Result |
|---|---|
| Dashboard | Sources 412, Studies 118, Claims 294, Evidence Review 267, Regulatory Review 2, Approved 294, Rejected 0 |
| Claims tab | “Keine offenen claim-Einträge in Postgres” (all claims already approved) |
| Evidence Review | 267 Postgres rows listed; **no review action clicked** |
| Product Mapping | “Nur Artikelcode und Substanz. Keine Preise, kein Warenkorb.” |
| Regulatory Review / Review Queue dedicated click | **not clicked** after automation blocked a tab click as write-risk; counts visible on dashboard |

Dual Read: Mode **postgres**, verdict **DUAL_READ_READY · critical 0**. Stale “Lexikon bleibt Legacy” sentence remains.

## Shop

`/shop` read-only: four groups (165 / 51 / 79 / 3). Cart badge **1 Artikel** unchanged. **No order. No cart mutation.**

## Auth

Session **pepsidryage** remained. Admin nav present. Dashboard “Willkommen, pepsidryage”. **No logout.**

## Network

Lexicon primary: Supabase REST (`cnjrjinvxycdkrmzcime.supabase.co/rest/v1/…`). **No** `published.json` HTTP as primary research source. Fallback science remains a **bundled JS chunk** for exclusive fallback only.

## Console

No “Slot failed to slot onto its children”. No React error overlay. No 404/500 on lexicon/calculator/admin/shop HTML navigations. No RLS error overlay on public lexicon (REST lists returned and mapped 27 identities). Full historical console dump across every route was **not** captured as a persistent log file.

## Performance

Lexicon list/detail load the public REST bundle (selective columns + approved filters), not the full research DB dump. Catalog/fallback chunk remains in the client for exclusive fallback (~348 kB class, as in Phase 11 local build). React Query cache 30s / retry 0 (code). Search and detail were interactive after first Postgres fetch.

## Database integrity (after deploy, read-only)

| Table | Count |
|---|---|
| substances | 27 |
| sources | 412 |
| studies | 118 |
| claims | 294 |
| evidence_assessments | 294 (27 approved / 267 review-required) |
| regulatory_records | 41 |
| review_actions | 19 |
| product_substances | 93 |
| products | 320 |
| orders | 0 |
| carts | 6 total (2 `draft`, 1 `ready`, 3 `ordered`) |

“2 active carts” in earlier notes referred to draft carts, not a `status=active` column. Counts match the pre-11C production research fingerprint. Shop product count unchanged.

## Known limitations

1. Exclusive **legacy fallback was NOT TESTED** on production (no artificial Postgres outage).
2. Admin Dual Read copy still says public lexicon is file-based while Mode is `postgres`.
3. `publishedScienceSeed` / catalog JS still ships for fallback; that is expected, not a `published.json` primary fetch.
4. Cart drawer interior and checkout were not opened (read-only constraint).
5. Dedicated Regulatory Review / Review Queue tab bodies were not opened (write-risk block); dashboard counts only.
6. Git working tree after this report is **dirty with docs only**. This file is **not** committed.

## Rollback

Application: previous Vercel production `dpl_BTukrYBjxY1rAURuznPqgBhMxbHn`, or set `VITE_RESEARCH_DB_MODE=legacy` and redeploy the SPA. **Not** the 0023 SQL dump.

## STOP

No Batch 03. No community. No new commit. No push. No further phase.

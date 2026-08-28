# Production Admin Browser QA

**Date:** 2026-08-29  
**Verdict:** **BROWSER_QA_NOT_READY**  
**Git:** no commit, no push.  
**Deploy:** none. **Database:** no migration, no writes, no review actions, no orders.

## Environment

| Item | Value |
|---|---|
| Production SPA | `https://cartwise-zeta.vercel.app` (`pepsi7/cartwise`) |
| Bundle | `index-CoeZiILn.js` (Phase 10C) |
| Database | `cartwise-prod` (`cnjrjinvxycdkrmzcime`) |
| Public lexicon | **legacy** (`catalog.ts` + `published.json`) — `27 von 27 Profilen · keine Shoppreise` |
| Admin Research | Postgres primary — queue labeled **Postgres**; no Legacy-Fallback |
| `VITE_RESEARCH_DB_MODE` | unset → **legacy** (Dual-Read debug not shown) |

Not used: `https://cartwise.vercel.app`. No secrets, tokens, cookies, or `.env` values were read or printed.

## Session

Existing Cursor browser tab was already on `/admin/research` (`Research Queue \| Peptix Admin`). Auth storage present (`sb-…-auth-token` name only). Chrome showed **pepsidryage**. Admin nav (Research current) rendered. `/admin/research` opened without bypass.

Logout was **not** performed. No password/credential access. No RLS bypass.

## Dashboard (Admin Research)

| Stat | Expected | Actual |
|---|---|---|
| Sources | 412 | **412** |
| Studies | 118 | **118** |
| Claims | 294 | **294** |
| Review Required | 267 evidence + 2 regulatory = 269 | **269** |
| Approved (claims) | 294 | **294** |
| Rejected | 0 | **0** |
| Evidence Review | 267 | **267** |
| Regulatory Review | 2 | **2** |
| Community Updates | 0 | **0** |
| Research Updates | 0 (`research_updates` table absent) | **0** |
| Substances 27 | dashboard has no substance tile | **27** on public lexicon list |
| Product mappings 93 | mapping table has no total line | **90** unique codes collected across pages (pagination timing; expected 93) |
| Review actions 19 | no dashboard tile | substance Review Queue showed **19 Einträge · Seite 1 · Postgres** |

PageHeader: *Postgres ist die Admin-Quelle. Community bleibt unavailable. Das öffentliche Lexikon bleibt dateibasiert.* Connector Health all **unavailable** (expected). Dual-Read panel absent (legacy).

## QA matrix

| Test | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| Existing admin session | Logged in, admin, `/admin/research` | Session + admin chrome + Research Queue | **PASS** | No auto-login |
| Dashboard counts | 412 / 118 / 294 / 267 evidence / 41 regulatory scale | Matches; Review Required 269 = 267+2 | **PASS** | |
| Evidence queue | 267 review-required, Postgres | `267 Einträge · Seite 1 · Postgres`; Retatrutide/Tirzepatide items | **PASS** | Pagination **Weiter** present; no mass action |
| Evidence detail | Substance, claim, human evidence, confidence, review status, sources | Retatrutide · `safety`; GI Phase-2 statement; 2 PubMed sources (PMID 37366315, 37385280); actions visible, **disabled** until reason | **PASS** | `evidence_level` / `confidence` / `evidence_type` not rendered on this row (null or UI omits `evidenceType`). Review status on queue badge, not in detail heading |
| Claim via evidence (Phase-3) | Claim text, type, sources, studies | `current_research`; TRIUMPH/TRANSCEND; 3 clinical_trial sources | **PASS** | |
| Source traceability | Title, type, identifier | pubmed + PMID/DOI; clinical_trial + NCT | **PASS** | |
| Study | NCT, title, sponsor, phase, status | NCT06383390 / NCT05929066 / NCT06354660; PHASE3; Eli Lilly; ACTIVE_NOT_RECRUITING / COMPLETED | **PASS** | No standalone Studies browser — studies on claim/evidence detail |
| Claims tab | Open a claim | `Keine offenen claim-Einträge in Postgres` (all 294 approved) | **PASS** | Claim body inspected via evidence detail instead |
| Regulatory queue | 2 review-required | hCG EMA Ovitrelle; semaglutide FDA US OZEMPIC (ORAL SEMAGLUTIDE) | **PASS** | |
| Regulatory detail | Authority, region, status, product, current, source | Human Chorionic Gonadotropin · ema EU; status `unknown` · Ovitrelle · **not current**; EMA EPAR source | **PASS** | Indication mapped to rationale/note; no application id on this row |
| Orforglipron FOUNDAYO NDA220934 US | Open regulatory record | **Not in review-required queue** (approved records are not listed). List card: Orforglipron **Approved for specific indication · Evidence A**. Detail page **crashed** | **FAIL** | Cannot confirm FOUNDAYO/NDA220934 in live Admin or lexicon detail UI. Copy exists in `published.json` (not a live UI check) |
| Retatrutide `clinical_development` | Visible | Lexicon list: **Clinical development · Evidence B**. Admin regulatory queue does not list approved/current FDA clinical_development rows | **PASS** | List-level only; detail crash |
| Review Queue (substances) | Open reviews, no mass actions | 19 substances `review-required`; page 1 Postgres | **PASS** | |
| Review actions workflow | Visible, not executed | `approve` `reject` `request_review` `publish` `unpublish`; disabled without Begründung | **PASS** | None clicked |
| Product mapping RT5–RT40 | → retatrutide | All five `prefix` → `retatrutide` | **PASS** | |
| TR / SMO / TA / ML10 / Glow | Tirzepatide / Sermorelin / TA-1 / Melanotan II / Glow Blend | TR* `manual` tirzepatide; SMO* sermorelin; TA5/TA10 thymosin-alpha-1; ML10 melanotan-ii; BBG70 glow-blend `name` | **PASS** | |
| Unresolved BT / MT1 / KL80 | Not wrongly mapped | **0** rows in mapping table | **PASS** | |
| Mapping prices | None | Columns Code / Name / Substance / Method; copy *Keine Preise, kein Warenkorb* | **PASS** | `Preisregeln` in admin nav is unrelated |
| Public `/peptide` | Hub | Rechner + Lexikon cards; session kept | **PASS** | |
| `/peptide/lexikon` list | Search, filters, 27 cards, no shop prices | Search, categories, status filters, 27/27, no cart CTAs | **PASS** | Legacy files |
| Search Reta / Retatrutide / LY3437943 | Retatrutide only | 1/27 Retatrutide | **PASS** | |
| Search Tirze / Tirzepatide | Tirzepatide only | 1/27 | **PASS** | |
| Semax / Selank / MOTS-c | Correct identity | Each 1/27 | **PASS** | |
| TB-500 vs Thymosin Beta-4 | Not merged | TB-500 → TB-500 + Glow Blend (name contains TB-500); **not** Thymosin Beta-4. Thymosin Beta-4 → itself only | **PASS** | |
| Lexicon **detail** pages | Retatrutide, Tirzepatide, Semaglutide, Orforglipron, TB-500, TB4, Melanotan II, IGF-1 LR3, Glow | Hard nav and in-app **Profil öffnen** unmount `#root`. Console: `Slot failed to slot onto its children` (`button-C9NJmCLl.js`) | **FAIL** | `Button asChild` + `{loading && <Loader2/>}{children}` is two Slot children. Same pattern on calculator |
| List-level identities | No false merges | TB-500 ≠ TB4; Melanotan II aliases MT-2 (not afamelanotide); IGF-1 LR3 Investigational F (not mecasermin); Glow = GHK-Cu + TB-500 + BPC-157 | **PASS** | Cards only |
| `/peptide/rechner` | Reconstitution, concentration, units, vial | Blank `#root` after load (same Slot crash; calculator PageHeader uses `Button asChild`) | **FAIL** | |
| `/shop` | Products, navigation | Four groups 165 / 51 / 79 / 3; peptides list with search and add-to-cart; prices visible in shop (expected) | **PASS** | No order. Shop is list+cards (`/shop?cat=peptides`), no separate product route |
| Cart | Read-only | Existing cart, 1 line, totals shown. Checkout not submitted. Delete/add not clicked | **PASS** | |
| Auth / admin access | Session + admin | Dashboard welcome; role VIP in chrome; Admin nav; Research works | **PASS** | No logout |
| Console | No JS/React/404/500/RLS noise | Slot uncaught error on lexicon detail + calculator. Shop/admin/list: no failed network (status ≥400) on sampled resources | **FAIL** | Error is application crash, not auth |
| Network | Vercel assets + Supabase | `cartwise-zeta.vercel.app` assets **200**; `cnjrjinvxycdkrmzcime.supabase.co` requests present. No tokens in URLs | **PASS** | Paths not dumped |
| Security | Admin research visible via real session | Queue, evidence, mapping, dashboard visible. No bypass | **PASS** | |
| Mobile 390×844 | Nav, lexicon, detail, calculator, admin | Lexicon list + Admin Research OK at 390×844. Detail + calculator still crash | **FAIL** | Detail/calculator independent of viewport |
| No data mutation | Read-only | No approve/reject/delete/bulk/order. Cart still 1 item after QA | **PASS** | |

## Console

Captured on lexicon detail navigation (no stack tokens):

`Uncaught Error: Slot failed to slot onto its children. Expected a single React element child or \`Slottable\`.`  
Source chunk: `/assets/button-C9NJmCLl.js`

Cause in code: `src/components/ui/button.tsx` always wraps `Loader2` + `children` inside Radix `Slot` when `asChild` is set. Used by `PeptideLexiconDetail.tsx` (*Im Rechner verwenden*) and `PeptideCalculator.tsx` (*Zum Lexikon*). The React tree unmounts (`#root` innerHTML length 0).

No 404/500 on Vercel assets in the resource sample. No RLS error strings in the UI. No secrets in console.

## Network

| Host | Role |
|---|---|
| `cartwise-zeta.vercel.app` | SPA HTML/JS/CSS (`index-CoeZiILn.js`, `AdminResearch-*.js`, `catalog-*.js`, `button-C9NJmCLl.js`) |
| `cnjrjinvxycdkrmzcime.supabase.co` | Auth + research/shop queries (status 200 in sample) |
| fonts.googleapis.com / gstatic | Fonts |

## Mobile

Emulation **390×844**: lexicon list (search + 27 profiles + bottom nav) and `/admin/research` (counts + tabs + Postgres) rendered. Lexicon detail and calculator remain broken.

## Known limitations

- Admin Regulatory Review lists only `review_status = review-required` (2 rows). Approved records (FOUNDAYO, Retatrutide FDA clinical_development) are not browsable in that tab.
- Claims tab lists only `review-required` / `draft` — empty because 294 claims are approved.
- Admin evidence detail does not always show human evidence grade / confidence.
- Mapping pager does not print `93 Einträge`.
- Nested hard-loads sometimes showed `Wird geladen …` first; list/hub/admin recovered. Detail/calculator did **not** recover (Slot crash).
- Dual-Read not exercised (production stays `legacy`).
- Logout, checkout, review writes, and Batch 03 were out of scope.

## STOP

No lexicon Postgres switch. No Batch 03. No community. No commit. No push. No deploy. No database change. Session left on `/admin/research`.

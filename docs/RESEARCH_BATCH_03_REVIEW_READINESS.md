# Batch 03 Review Readiness Audit

**Date:** 2026-08-29  
**Mode:** read-only  
**Verdict:** **BATCH_03_REVIEW_READY_WITH_LIMITATIONS**  
**No write, no approve, no import, no Batch 04, no commit, no push, no deploy.**

Production: `https://cartwise-zeta.vercel.app` · Database: cartwise-prod · Migration: **0029**

## Scope

Audit of Research Batch 03 candidates plus the existing Admin Research review workflow.

| Bucket | Location | Count | In production Postgres? |
|---|---|---|---|
| New sources (review-required candidates) | `src/research/cache/fetched/batch03/analysis.json` | **108** | **No** |
| Validated new studies | same | **36** | **No** |
| Review-required evidence assessments | live `evidence_assessments` | **267** | **Yes** |
| Existing sources / studies | live tables | 412 / 118 | Yes (unchanged) |

## 108 new sources

All 108 rows are `publication: review-required` (72 PubMed + 36 clinical_trial). None are Hudson NCTs. Every row has:

- substance slug
- identifier (`pmid` or `NCT########`)
- title
- kind / source type
- review state `review-required`

PubMed rows also have `pubdate` and optional DOI. Clinical-trial source rows store the NCT id; URL and last-update live on the paired study object.

**Not present as Postgres rows:** no `sources.id` UUID, no `source_substances` row, no orphan DB records. Candidates are local analysis JSON only.

**URL:** not stored as a separate field on PubMed candidate objects; URL is `https://pubmed.ncbi.nlm.nih.gov/{pmid}/`. Trial URLs are on the 36 study objects.

No Batch 03 source was auto-published.

## 36 validated studies

Each has NCT, title, sponsor, intervention, condition, phase, status, substance slug, URL, `publication: review-required`. Query-pollution titles (e.g. retatrutide NCT07226947 exercise/GLP-1 without INN in title) are **not** in this 36. Identity mismatches (TB-500/TB4, Melanotan II/afamelanotide, IGF-1 LR3/mecasermin) are **not** in this 36.

**Not in** `studies` / `study_substances` on production. Public lexicon does not list Batch 03-only NCTs such as NCT07357415 / NCT07232719.

## 267 review-required evidence assessments

Live counts: 294 evidence rows = **27 approved overlays** + **267 review-required**. Zero evidence without a claim. Zero claims without a source. Admin Evidence Review shows **267 Einträge · Seite 1 · Postgres**, status badge `review-required`. Sample detail (Retatrutide safety): claim + PMID 37366315 / 37385280. Approve/reject/publish buttons exist; **this audit did not click them**.

These 267 are **not** the 108/36 Batch 03 candidates. They are claim-level assessments from the existing import.

## Review queue

`/admin/research` (production, logged-in admin `pepsidryage`):

| UI | Observed |
|---|---|
| Total Sources / Studies / Claims | 412 / 118 / 294 |
| Review Required (dashboard) | **269** = 267 evidence + 2 regulatory + 0 claims |
| Approved / Rejected | 294 / 0 (claims) |
| Evidence Review | 267, `review-required` |
| Regulatory Review | 2 |
| Claims tab | filter `review-required` \| `draft` (0 live `claims` in review-required) |
| Review Queue | 19 `review_actions` / substance open items |
| Product Mapping | codes + substance, no prices (RT*, SM*, BBG70 glow-blend on page 1) |
| Community / Research Updates | 0 / 0 |

**Limitation:** there is **no Sources tab and no Studies tab**. Batch 03’s 108 sources and 36 studies **cannot** appear as review-required entities until imported. The existing queue correctly shows seeded evidence/regulatory/review_actions only.

Production Dual Read copy is still the pre-12A sentence (“Lexikon bleibt dateibasiert”). Local source was corrected in Phase 12A and is **not deployed**.

## Review semantics

Workflow statuses in SQL/UI: `draft` · `review-required` · `approved` · `rejected`.  
Admin actions: `approve`, `reject`, `request_review`, `publish`, `unpublish` (reason required).

Profile field `reviewStatus` (`fresh` / `review-recommended` / `review-required`) is **not** the same enum. `review-recommended` is not a queue tab. That naming split is pre-existing.

## Review actions

`review_actions`: SELECT + INSERT admin-only; **no UPDATE/DELETE policy**. Submit path **inserts** a row then **updates the entity** workflow column (claim/evidence/regulatory). History remains append-only. This audit performed **no** insert/update.

## Source / study / claim traceability (production)

| Check | Result |
|---|---|
| Source → substance | 0 sources without `source_substances` |
| Study → substance | 0 studies without `study_substances` |
| Study → source | 0 studies without a source link / matching NCT source |
| Claim → source | 0 claims without `claim_sources` |
| Evidence → claim | 0 assessments without claim |

Batch 03 candidates: substance assignment in JSON only; no DB orphans because they were not inserted.

## Evidence rule / community

Community connector **unavailable** on Admin Research. `communityCannotAppearAsScientificEvidence` filters blog/reddit/forum/community. Batch 03 did not add community sources. Evidence A–F overlays unchanged (27).

## Regulatory

Batch 03 regulatory changes = 0. Live regulatory still 41. Tesamorelin EMA Egrifta withdrawn page was **not** applied as EU approval.

## Public lexicon / API

`fetchPublicLexicon` selects claims `status=approved` and evidence `review_status=approved`. Client mapper hides `draft` / `review-required` / `rejected`. Hudson NCTs excluded from study lists.

Browser:

- `/peptide/lexikon`: **27 von 27**, last reviewed **28.08.2026** (not Batch 03 29.08), no `review-required` label, no NCT07357415
- `/peptide/lexikon/retatrutide`: clinical development, Evidence B; Batch 03-only NCTs absent
- `/peptide/lexikon/tb-500`: Evidence F; identity note keeps TB-500 ≠ Thymosin Beta-4
- `/peptide/lexikon/melanotan-ii`: Evidence F; Afamelanotid/Scenesse distinguished
- `/peptide/lexikon/glow-blend`: blend, Evidence F, no NCTs

**Limitation:** approved *claim text* on TB-500 / Melanotan II **mentions** NCT07487363 / NCT07437560 as **excluded/fictional**, not as studies. Zero rows in `studies`/`sources.nct_id` for those NCTs.

## RLS

| Role | Claims | Evidence | Regulatory | Review actions | Sources / studies |
|---|---|---|---|---|---|
| Anon | no grant | no grant | no grant | no grant | no grant |
| Authenticated non-admin | `status = approved` | `review_status = approved` on approved claim (0028) | current + approved | none | all imported rows (no review_status column) |
| Admin | all | all including 267 | all | SELECT+INSERT | all + write |

Batch 03 candidates are **not** in sources/studies, so they cannot leak via authenticated SELECT. If they were imported later **without** a review gate, sources/studies RLS would expose them to any logged-in user. That is a **future import** risk, not a current leak.

## Identity

TB-500 ≠ Thymosin Beta-4; Melanotan II ≠ afamelanotide; IGF-1 LR3 ≠ mecasermin (catalog + Batch 03 filters); glow-blend = blend. No Batch 03 identity merge.

## Hudson

| Surface | NCT07487363 / NCT07437560 |
|---|---|
| `studies` / `sources.nct_id` | **0** |
| Public study lists | **0** |
| Admin published study counts | 118 unchanged |
| Raw Batch 03 cache | present (allowed) |
| Public claim prose | mentioned as excluded |

## Product mapping (unchanged)

RT* → retatrutide; TR* → tirzepatide; SMO* → sermorelin; TA* → thymosin-alpha-1; ML10 → melanotan-ii; BBG70 → glow-blend. **BT\*, MT1, KL80:** no `product_substances` rows.

## Production safety

Live inventory **unchanged** vs pre-Batch 03: 27 / 412 / 118 / 294 / 294 / 41 / 19 / 93. `research_runs` still **2** (batch-01/02). Batch 03 run is local `batch03/run.json` only. 108+36 do **not** appear as approved extra rows.

## Tests / gates (2026-08-29)

| Gate | Result |
|---|---|
| `npm test` | **434 passed / 35 files** |
| Typecheck | pass |
| Lint | 0 errors, 5 existing react-refresh warnings |
| Build | pass |

No tests deleted.

## Limitations (not blockers)

1. Batch 03 108 sources / 36 studies are **not in the Admin Review queue** (not imported).
2. Admin has no dedicated Sources/Studies review tabs.
3. Production Dual Read / header copy still pre-12A until SPA deploy.
4. Hudson NCT **strings** remain in two exclusion claims.
5. `sources`/`studies` have no `review_status`; import must stay review-gated.
6. Workflow `review-required` vs profile `review-recommended` are different fields.

## Verdict

**BATCH_03_REVIEW_READY_WITH_LIMITATIONS**

Existing 267 evidence items are reviewable in Admin without auto-approval. New Batch 03 hits are held locally as review-required and are **not** public. They are **not** yet first-class admin queue entities. Do not auto-approve, import, or start Batch 04 until asked.

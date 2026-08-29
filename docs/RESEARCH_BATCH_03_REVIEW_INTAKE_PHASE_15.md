# Research Batch 03 review intake (Phase 15)

**Date:** 2026-08-29  
**Production DB:** 0029 (`cartwise-prod`)  
**Production write:** none  
**Commit / push / deploy:** none  
**Batch 04 / community / research-update engine:** not started  

**Verdict:** **BATCH_03_REVIEW_INTAKE_READY_WITH_LIMITATIONS**

Existing `sources` / `studies` tables are not enough for a safe intake: `sources.status` is lifecycle (`active|superseded|unavailable|rejected`), `studies.status` is ClinicalTrials.gov overall status, and neither table has a workflow `review_status`. Importing the 108/36 candidates into current rows would expose them to authenticated lexicon users. A schema change is therefore required. It is **not applied**.

## MIGRATION_REQUIRED

File (in git, **not applied**): `supabase/migrations/0030_research_source_study_review_intake.sql`

Intended changes (after an approved apply prompt only):

- `sources.review_status` (`draft|review-required|approved|rejected`), existing rows backfilled `approved`
- `sources.connector` (nullable)
- `studies.review_status` (same enum), existing rows backfilled `approved`
- `studies.intervention`, `studies.condition` (nullable text)
- `review_actions.entity_type` extended with `source` and `study`
- SELECT RLS: non-admin sees only `review_status = approved` (sources also `status = active`); admin sees the review queue
- No `DROP TABLE`, no `DELETE FROM`, no `TRUNCATE`

Until 0030 is applied, Batch 03 candidates stay **local** and appear in Admin Research as `intake:…` placeholders. Approve/Reject is disabled for those IDs and does not insert `review_actions`.

Do **not** deploy the SPA that SELECTs `sources.review_status` / `studies.review_status` before 0030: that query would fail on 0029 and trigger exclusive public-lexicon fallback.

## Candidates vs production

| | Production (live 0029) | Batch 03 analysis | Intake plan | Written to Postgres |
|---|---|---|---|---|
| Substances | 27 | 27 reviewed | — | unchanged |
| Sources | 412 | 108 new review-required | 104 import, 4 relationship, 0 duplicate, 0 rejected, 0 Hudson | **0** |
| Studies | 118 | 36 validated | 36 import, 0 duplicate, 0 relationship, 0 rejected, 0 Hudson | **0** |
| Claims | 294 | 0 added | 0 | unchanged |
| Evidence | 294 (267 review-required) | 0 changes | 0 | unchanged |
| Regulatory | 41 | 0 changes | 0 | unchanged |
| Review actions | 19 | — | none executed | unchanged |

Planner: `src/lib/peptide/research/batch03Intake.ts` against `src/research/cache/fetched/batch03/analysis.json` and published overlays. Dedupe keys: PMID, DOI, NCT, published slug pairs, intra-batch identifier sets.

## Relationship-only (no source duplicate)

These four PMIDs already exist on another substance in `published.json`. The plan records a **relationship** (add `source_substances` after import), not a second `sources` row:

- `ipamorelin:pubmed:42578445`
- `orforglipron:pubmed:42419792`
- `semaglutide:pubmed:40353578`
- `semaglutide:pubmed:40544433`

## Hudson

`NCT07487363` and `NCT07437560` are not among the 108/36. The planner still rejects them if injected. Raw Batch 03 cache may still contain the strings; they are not import candidates.

## Identity

- TB-500 ≠ Thymosin Beta-4
- Melanotan II ≠ Afamelanotide
- IGF-1 LR3 ≠ Mecasermin
- Glow Blend = blend (not an INN source target)

No identity rejects in the 108/36 set. Glow-blend is not in the import lists.

## Review status

Every planned source/study row is `review-required`. None are `approved`. No automatic publication, evidence upgrade, regulatory change, or claim creation.

## Admin queue

`/admin/research` tabs: **Sources**, **Studies**, Evidence, Regulatory, Claims, Review Queue, Product Mapping.

Until 0030 + import:

- Source Review / Study Review counts come from the local plan (104 / 36)
- Banner: `MIGRATION_REQUIRED: 0030_research_source_study_review_intake`
- Source detail: substance, title, identifier, URL, source type, publication date, connector, review status
- Study detail: NCT, title, sponsor, intervention, condition, phase, status, substance, linked sources
- Approve/Reject disabled for `intake:` IDs; `review_actions` stay append-only (no UPDATE/DELETE policy)

After 0030 + import, the same tabs read Postgres `review_status = review-required` and admin approve updates `sources.review_status` or `studies.review_status` after an append-only `review_actions` insert. This prompt did **not** execute those actions.

## Public visibility

- Public fetch filters `sources` and `studies` with `review_status = approved`
- Client `isPublicSource` / `isPublicStudy` hide `review-required` (missing column treated as approved for pre-0030 seed mocks)
- Hudson NCTs remain excluded
- Review-required candidates are not in production tables, so live public lexicon still shows the previous 412/118 approved-path inventory

## RLS (intended in 0030, not live)

- Public / non-admin authenticated: approved (and for sources, `active`) only
- Admin: full review queue
- `review_actions` remain admin SELECT + INSERT only

Live 0029 still allows authenticated SELECT of all studies and of `active` sources. That is why intake must not write production until 0030.

## Tests

`src/tests/researchBatch03IntakePhase15.test.ts` covers source/study intake, duplicate/relationship detection, Hudson exclusion, identity, review status, public vs admin visibility, RLS migration text, and append-only review-action drafts. Existing tests were not deleted.

## Known limitations

1. **MIGRATION_REQUIRED** — 0030 not applied; production remains 0029.
2. **Import pending** — 104 sources + 36 studies + 4 relationships are planned, not persisted.
3. **SPA deploy blocked** until 0030 (unknown-column would exclusive-fallback the public lexicon).
4. Relationship rows are planned, not written to `source_substances`.
5. Admin Sources/Studies queue is local placeholders until import.
6. Dual-read production copy, Batch 03 cache, and Phase 12A text remain undeployed.
7. 267 evidence review-required and 2 regulatory review-required unchanged.
8. Community remains unavailable.

## Stop

No Batch 04. No community. No automatic approval. No deploy. No commit. No push.

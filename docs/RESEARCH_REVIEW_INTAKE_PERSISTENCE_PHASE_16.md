# Research review intake persistence (Phase 16)

**Date:** 2026-08-29  
**Production DB:** 0029 (`cartwise-prod`)  
**Production apply:** none  
**Commit / push / deploy:** none  
**Batch 04 / community / research-update engine:** not started  

**Persistence verdict:** schema + import path ready locally.  
**Apply verdict:** see `docs/RESEARCH_MIGRATION_0030_READINESS.md` — **READY_WITH_LIMITATIONS**.

## Migration 0030

File: `supabase/migrations/0030_research_source_study_review_intake.sql`

| | |
|---|---|
| Tables created | none |
| Tables altered | `sources`, `studies`, `review_actions` |
| Columns | `sources.review_status`, `sources.connector`; `studies.review_status`, `studies.intervention`, `studies.condition` |
| Indexes | `sources_review_status_idx`, `studies_review_status_idx` |
| Foreign keys | none added |
| Triggers | none added (existing `set_updated_at` unchanged) |
| Constraints | `sources_review_status_check`, `studies_review_status_check`; `review_actions.entity_type` adds `source` and `study` |
| RLS | SELECT rewritten for sources, studies, source_substances, study_substances, study_sources; `REVOKE ALL` from `anon` |
| Data | existing sources/studies backfilled `review_status = approved`; **no Batch 03 INSERT** |
| Shop / auth | untouched |

Local Docker Postgres (stub research tables, not a 0029 dump): **LOCAL_0030_SCHEMA_PASS**. Existing seed row became `approved`. New-column default is `review-required`.

## Review status model

| Column | Meaning | Not to be used as |
|---|---|---|
| `sources.status` | lifecycle `active\|superseded\|unavailable\|rejected` | public approval |
| `sources.review_status` | workflow `draft\|review-required\|approved\|rejected` | — |
| `studies.status` | ClinicalTrials.gov overall status (`RECRUITING`, `COMPLETED`, …) | public approval |
| `studies.review_status` | workflow, same enum as sources | — |

New rows default to **review-required**. Existing 412/118 are backfilled **approved** so current public lexicon does not disappear after apply.

## Source / study intake

In-memory persist (`src/lib/peptide/research/batch03Persist.ts`) against published seed:

| | Inserted | Linked | Duplicate skipped | Production written |
|---|---|---|---|---|
| Sources | 104 | 108 (104 new + 4 relationship) | 0 on first run | **0** |
| Studies | 36 | 36 | 0 on first run | **0** |

All new rows: `review_status = review-required`, sources `status = active`. Clinical trial `status` (e.g. RECRUITING) is stored on studies and is not approval.

SQL renderer: `renderBatch03IntakeSql` — `BEGIN`/`COMMIT`, `ON CONFLICT DO NOTHING`, no `DELETE`/`TRUNCATE`, no claims/evidence/regulatory writes. Not placed in `supabase/migrations/` so `db push` cannot import data by accident.

Second persist: 0 inserts, same row counts (idempotent). Forced failure restores the snapshot (transactional rollback in the persist engine).

## Relationship-only

PMID 42578445, 42419792, 40353578, 40544433: existing source kept; `source_substances` link added for the extra substance. No second `sources` row.

## Hudson / identity

Hudson NCT07487363 / NCT07437560 excluded if injected. Identity: TB-500 ≠ TB4, MT-II ≠ afamelanotide, IGF-1 LR3 ≠ mecasermin, glow-blend rejected as INN target. No identity rejects in the real 104/36 set.

## RLS / visibility

| Role | Sources | Studies |
|---|---|---|
| anon | no GRANT; no SELECT | same |
| authenticated (non-admin) | `status = active` **and** `review_status = approved` | `review_status = approved` only (CT.gov status ignored) |
| admin | all review states | all review states |
| writes | existing `has_role(..., 'admin')` INSERT/UPDATE/DELETE | same |

Junction SELECT follows parent approval so review-required candidates are not leaked as link rows to non-admins.

Public lexicon client: `isPublicSource` / `isPublicStudy` require `review_status = approved`. Admin Research Sources/Studies tabs already page (20). Approve/Reject stays disabled for local `intake:` placeholders until 0030 + import write real UUIDs.

`review_actions`: still append-only (SELECT + INSERT admin). No UPDATE/DELETE policy. Approval after persist = insert action then update entity `review_status`. Not executed in this phase.

## Unchanged

Claims 0 created. Evidence 267 review-required unchanged. Regulatory unchanged. Product mapping (BT / MT1 / KL80 / blends / fragments / amides) unchanged. Community unavailable.

## Tests

`src/tests/researchReviewIntakePersistencePhase16.test.ts`: review status, public/admin visibility, RLS helpers, duplicates, idempotency, Hudson, identity, relationship-only, review-action drafts, SQL renderer. Existing tests kept.

## Known limitations

1. Production still 0029; 0030 not applied.
2. Batch 03 SQL import not executed anywhere live.
3. Docker 0030 test used stub tables, not a restored 0029 dump; `auth.uid()` / `has_role` were stubs.
4. Do not deploy the SPA that SELECTs `review_status` before 0030.
5. Admin queue still uses local `intake:` placeholders until import.

## Stop

No production apply. No deploy. No commit. No push. No Batch 04. No community. No update engine.

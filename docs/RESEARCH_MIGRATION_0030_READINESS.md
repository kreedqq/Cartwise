# Migration 0030 readiness

**Date:** 2026-08-29  
**Live project:** `cartwise-prod` (`cnjrjinvxycdkrmzcime`)  
**Applied in Phase 17:** `docs/RESEARCH_PRODUCTION_MIGRATION_0030.md`

## Verdict

**APPLIED** — **PRODUCTION_0030_APPLY_SUCCESS_WITH_RLS_LIMITATION**

This file was the pre-apply checklist. Production is **0030** with Batch 03 104/36 review-required. GoTrue user JWT RLS remains a documented limitation.

## Versions

| | |
|---|---|
| Current production | **0030** |
| Target | applied (`0030_research_source_study_review_intake.sql`) |
| Batch 03 rows on production | 104 sources + 36 studies, review-required |

## Schema changes

| Object | Change |
|---|---|
| `sources` | add `review_status` (NOT NULL, default `review-required`, check enum); add `connector`; backfill existing to `approved` |
| `studies` | add `review_status` (same); add `intervention`, `condition`; backfill existing to `approved` |
| `review_actions` | `entity_type` check adds `source`, `study` |
| Indexes | `sources_review_status_idx`, `studies_review_status_idx` |
| FKs / triggers | none new |
| DROP TABLE / TRUNCATE / DELETE FROM | none |

Idempotent shape: `IF NOT EXISTS` columns/indexes, `DROP CONSTRAINT/POLICY IF EXISTS` then recreate.

## RLS changes

- `REVOKE ALL` on sources/studies/junctions/`review_actions` from `anon`
- Non-admin SELECT sources: `active` **and** `review_status = approved` (lifecycle is not approval)
- Non-admin SELECT studies: `review_status = approved` (CT.gov status is not approval)
- Admin SELECT: all review states via `has_role(..., 'admin')`
- Junction SELECT follows parent approval
- No new public write policy; writes remain admin `has_role`

`review_actions` UPDATE/DELETE policies remain absent (append-only).

## Data impact

| After 0030 apply (no import) | |
|---|---|
| Existing 412 sources / 118 studies | `review_status = approved` |
| Public lexicon | should keep current approved inventory |
| Batch 03 | still 0 rows until import |
| Claims / evidence / regulatory | unchanged |
| New inserts omitting `review_status` | `review-required` (not public) |

Import (later): 104 sources + 36 studies as `review-required`; 4 PMID relationship links; 0 claims.

## Shop / auth impact

None. No `products`, prices, carts, orders, `user_roles`, or auth schema changes.

## Rollback plan

0030 is not self-reversing. Practical rollback if needed **after** a future apply:

1. Keep SPA on a build that does not SELECT `sources.review_status` / `studies.review_status`, **or**
2. Emergency public lexicon: `VITE_RESEARCH_DB_MODE=legacy` (not the 0023 dump)
3. Columns can remain; RLS can be restored to 0025 SELECT (`active` sources / all studies) only as a last resort — that would again expose any imported review-required rows, so drop or reject those rows first if import already ran
4. Do not restore 0023 as automatic application rollback

Take a Supabase backup/snapshot immediately before apply.

## Test results

| Gate | Result |
|---|---|
| Local Docker 0030 schema | **LOCAL_0030_SCHEMA_PASS** (`node scripts/test-migration-0030-local.mjs`) |
| Realistic 0023 restore + 0024–0030 + Batch 03 | **READY_WITH_RLS_LIMITATION** (`docs/RESEARCH_MIGRATION_0030_REALISTIC_LOCAL_VALIDATION.md`, `node scripts/phase-16a-realistic-local-validation.mjs`) |
| Persist / RLS / idempotency / Hudson / identity | `src/tests/researchReviewIntakePersistencePhase16.test.ts` |
| Existing suite | 452 passed (Phase 16A) |

## Risks

1. Apply 0030 then forget to deploy matching SPA → exclusive lexicon fallback (query unknown column).
2. Deploy SPA before 0030 → same fallback.
3. Import without 0030 → unique indexes exist but review-required rows would be public under 0029 RLS.
4. Constraint name `review_actions_entity_type_check` assumed; `DROP IF EXISTS` then add. If production used a different auto-name, the old check might remain until inspected — local stub used the same 0027 inline check name and succeeded.
5. GoTrue-signed JWT RLS is still **NOT TESTED**. Phase 16A tested `has_role` + PostgREST-equivalent GUCs only.

## Apply checklist (future prompt only)

1. Backup `cartwise-prod`
2. Apply **only** 0030 (no Batch 03 INSERT in that file)
3. Confirm 412/118 still `approved`; public lexicon still 27 profiles
4. Run idempotent Batch 03 import (`renderBatch03IntakeSql` / persist engine)
5. Confirm 104+36 `review-required`, hidden from non-admin
6. Deploy SPA that SELECTs `review_status`
7. Do not auto-approve

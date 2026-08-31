# Production migration 0030 + Batch 03 review intake (Phase 17)

**Date:** 2026-08-29  
**Live project:** `cartwise-prod` (`cnjrjinvxycdkrmzcime`, `eu-west-2`, `ACTIVE_HEALTHY`)  
**Database host:** `db.cnjrjinvxycdkrmzcime.supabase.co` (Postgres 17.6.1.165)  
**No commit. No push. No deploy.**

## Verdict

**PRODUCTION_0030_APPLY_SUCCESS_WITH_RLS_LIMITATION**

`0030_research_source_study_review_intake` applied to live `cartwise-prod`. Batch 03 intake persisted **104 sources + 36 studies** as `review-required`. Shop, auth, claims, evidence, regulatory, review actions, and product mappings are unchanged.

**RLS_VERIFIED_WITH_JWT_LIMITATION:** policies, grants, and `has_role` match the intended model. Anon has no SELECT on research tables. Signed GoTrue **user** JWTs were not issued against production. Phase 16A GUC RLS remains the last user-role simulation.

---

## Production identification

| | |
|---|---|
| Project | **cartwise-prod** (only org project) |
| Ref | `cnjrjinvxycdkrmzcime` |
| Status | `ACTIVE_HEALTHY` |
| Before | **0029** `research_explicit_product_mappings` |
| After | **0030** `research_source_study_review_intake` |

`supabase/config.toml` `project_id = shared-cart-app` is local CLI naming, not the live ref. Apply used `--linked --project-ref cnjrjinvxycdkrmzcime`.

---

## Backup

| | |
|---|---|
| File | `C:\Users\<USERNAME>\Documents\cartwise-prod-backup\cartwise-prod-0023-2026-08-28-full.sql` |
| Present | yes |
| Size | 1230487 bytes |
| LastWriteTime | 2026-08-28 21:30:08 |
| SHA-256 | `dae0ef581968cdd7a33eb5dc34c44064a0ff8fbfaa89a666b6e25d5897cb973a` |
| Match | yes |

This dump is **0023** (pre-research). It is the existing production backup artifact, not a snapshot of 0029. Restoring it would drop 0024–0030 research data. **Do not auto-restore.** Platform PITR is not available on the free plan.

---

## Pre-migration fingerprint (read-only)

| | Before |
|---|---|
| Migration | 0029 |
| products | 320 |
| price sum | 23925 |
| product fingerprint | `afd9f04bbf360fb5944709f30d653973` |
| carts | 6 / `2afb3aa49c3c2015061eb3c44441791f` |
| orders | 0 |
| auth.users | 2 / `76af77941b50c8bc6ff620fc81e9ac50` |
| substances | 27 |
| sources | 412 |
| studies | 118 |
| claims | 294 |
| evidence | 294 (267 review-required, 27 approved A–F) |
| regulatory | 41 |
| review_actions | 19 |
| product_substances | 93 |
| `sources.review_status` column | absent |

No unexpected deviation. Apply continued.

---

## Migration

Only `supabase/migrations/0030_research_source_study_review_intake.sql` via `supabase db query --linked --project-ref cnjrjinvxycdkrmzcime -f …`. Exit 0.

History row inserted: `schema_migrations` version **0030**, name `research_source_study_review_intake`.

0024–0029 were **not** re-applied.

### Post-0030, before intake

Existing 412 sources and 118 studies: all `review_status = approved`. New-row default `review-required`. Anon grants on `sources`: none. Indexes `sources_review_status_idx`, `studies_review_status_idx`. `review_actions.entity_type` includes `source` and `study`. Shop/auth fingerprints unchanged.

---

## Batch 03 intake

Idempotent SQL from `renderBatch03IntakeSql(buildBatch03IntakePlan(analysis.json))`. Applied with `BEGIN`/`COMMIT` via the same linked CLI. Not a numbered migration.

| | After intake |
|---|---|
| sources | **516** (412 approved + **104** review-required) |
| studies | **154** (118 approved + **36** review-required) |
| Relationship-only PMIDs `42578445`, `42419792`, `40353578`, `40544433` | 4 rows / 4 distinct (no extra source copies) |
| Hudson `NCT07487363`, `NCT07437560` | **0** sources, **0** studies |
| claims | 294 |
| evidence | 294 (267 review-required, 27 approved) |
| regulatory | 41 |
| review_actions | 19 |
| product_substances | 93 |

No auto-approve. No new claims/evidence/regulatory/review actions.

---

## Count report

| Object | Before | After |
|---|---|---|
| Migration | 0029 | **0030** |
| sources | 412 | **516** |
| studies | 118 | **154** |
| claims | 294 | 294 |
| evidence | 294 | 294 |
| regulatory | 41 | 41 |
| review_actions | 19 | 19 |
| product_substances | 93 | 93 |
| products | 320 | 320 |
| orders | 0 | 0 |
| auth.users | 2 | 2 |

Batch 03: **104** sources, **36** studies, all `review-required`. Hudson: **0**.

---

## Identity

TB-500 ≠ Thymosin Beta-4 (two ids). Melanotan II name unchanged (not afamelanotide). IGF-1 LR3 name unchanged (not mecasermin). Glow Blend `molecule_type`/`status` = `blend`.

---

## Shop / auth safety

Product fingerprint, price sum, cart fingerprint, and user fingerprint identical to pre-migration. 320 products, 0 orders, 2 users. No role changes.

---

## Public visibility

SQL: 412 approved sources and 118 approved studies remain the public-eligible set. 104/36 Batch 03 rows are `review-required`.

Per-slug approved vs hidden (same as local 16A):

| Slug | Approved sources | Review-required sources | Approved studies | Review-required studies |
|---|---|---|---|---|
| retatrutide | 28 | 11 | 12 | 6 |
| tirzepatide | 30 | 9 | 12 | 4 |
| semaglutide | 34 | 13 | 12 | 5 |
| orforglipron | 29 | 6 | 12 | 4 |
| tb-500 | 13 | 1 | 0 | 0 |
| thymosin-beta-4 | 22 | 6 | 12 | 5 |

Working-tree `fetchPublicLexicon` SELECTs sources/studies with `.eq(review_status, approved)` (no mix with `published.json` on a successful Postgres read).

Hosted SPA remains **`5e38cf1`** (Phase 11C). That build filters evidence `review_status=approved` but does **not** filter sources/studies by `review_status`. Non-admin users are still protected by 0030 RLS. **Admin** sessions on the hosted lexicon could see review-required rows until a matching SPA is deployed. This phase did **not** deploy.

**Public: PASS** (DB + non-admin RLS + working-tree client). Hosted admin lexicon is a documented SPA lag, not a 0030 data failure.

---

## Admin visibility

Postgres queue: **104** source candidates, **36** study candidates, `review-required`, real UUIDs. `BATCH03_PRODUCTION_IMPORT_PENDING` is now `false` in source so Admin Research reads those rows instead of `intake:` placeholders.

Hosted `/admin/research` is still `5e38cf1` and does not include the Phase 15 Sources/Studies intake UI. **Admin: PASS** at the database. UI follows the next SPA deploy (not this phase).

---

## RLS

| Check | Result |
|---|---|
| Anon table privilege SELECT sources/studies/`review_actions` | **false** |
| Authenticated GRANT SELECT sources | true (policies restrict rows) |
| Non-admin SELECT | `sources`: active **and** approved; `studies`: approved |
| Admin SELECT | all review states via `has_role(auth.uid(), 'admin')` |
| GoTrue **user** JWT on production | **NOT TESTED** |
| Phase 16A GUC + `has_role` | PASS (local restore, not re-run here) |

**RLS: PASS_WITH_LIMITATION** (`RLS_VERIFIED_WITH_JWT_LIMITATION`)

---

## Rollback

0030 is additive (columns, indexes, policies). It is not a one-command reverse.

If required after this apply:

1. Do **not** restore the 0023 dump (it wipes 0024–0030 research and post-0023 shop state).
2. Emergency public lexicon: `VITE_RESEARCH_DB_MODE=legacy` (SPA env), not a dump restore.
3. Batch 03 rows can stay `review-required` (hidden from non-admin). Do not auto-delete them.

---

## Known limitations

1. GoTrue-signed **user** JWT RLS was not live-tested on production.
2. Hosted SPA is still `5e38cf1`; working-tree review_status source/study filters and Admin intake tabs are **not** deployed.
3. Backup artifact is 0023, not a 0029/0030 snapshot.
4. No second production import was run (local 16A already proved idempotency). SQL is `ON CONFLICT DO NOTHING`.

---

## Tests (working tree after flag update)

| Gate | Result |
|---|---|
| `npm test` | **452 passed** / 37 files |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 existing warnings |
| `npm run build` | pass |

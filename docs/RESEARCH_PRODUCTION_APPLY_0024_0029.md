# Research Production Apply 0024–0029 (Phase 6C)

**Date:** 2026-08-28  
**Live project:** `cartwise-prod` (`cnjrjinvxycdkrmzcime`, `eu-west-2`, `ACTIVE_HEALTHY`)  
**Git HEAD:** `60131c0` on `main` (ahead of origin by 4). No commit. No push.

## Verdict

**PRODUCTION_APPLY_SUCCESS**

`0024` → `0029` applied to live and validated. Lexicon still reads `catalog.ts` + `published.json`. Dual-read not started. Community unavailable. Batch 03 not started.

A full Supabase-platform restore of the pre-apply dump was **not** tested (known backup limitation).

---

## Backup

| | |
|---|---|
| Status | `BACKUP_READY_WITH_LIMITATION` |
| File | `Documents\cartwise-prod-backup\cartwise-prod-0023-2026-08-28-full.sql` |
| Size | 1 230 487 bytes |
| SHA-256 (re-checked before apply) | `dae0ef581968cdd7a33eb5dc34c44064a0ff8fbfaa89a666b6e25d5897cb973a` (match) |
| Limitation | Local vanilla Postgres restore is not a clean full Supabase restore (missing roles). |

---

## Target

Only org project: **cartwise-prod**. `supabase/config.toml` `project_id = shared-cart-app` is local CLI, not the live ref. Apply used `--linked --project-ref cnjrjinvxycdkrmzcime`.

---

## Migration status

### Before

`0001`–`0023`. Research tables absent. Products 320, carts active 2 / all 6, orders 0, auth.users 2, 1 admin.

### After

`0001`–`0029` recorded in `supabase_migrations.schema_migrations`.

| Version | Name |
|---|---|
| 0024 | research_identity_and_product_mapping |
| 0025 | research_sources_studies_runs |
| 0026 | research_claims_and_evidence |
| 0027 | research_regulatory_and_review |
| 0028 | research_evidence_assessments_select_approved |
| 0029 | research_explicit_product_mappings |

SQL ran via `supabase db query --file` (CLI dump role). History rows were inserted after each successful file.

---

## Per migration

### 0024

Applied. Prefix refresh returned 17 mapping inserts (then glow name rows → 19 `product_substances` before 0029).

| Check | Result |
|---|---|
| substances | 27 |
| aliases | 46 |
| components | 3 |
| product_substances (then) | 19 |
| RLS on identity tables | on; 16 policies |
| FKs on `product_substances` | 2 |
| Shop | products 320, carts active 2, orders 0 |

### 0025

| Check | Result |
|---|---|
| sources | 412 |
| source_substances | 468 |
| studies | 118 |
| study_substances | 123 |
| study_sources | 118 |
| research_runs | 2 |
| research_run_sources | 413 |
| Hudson NCT entities in sources/studies | 0 |
| Shop | unchanged |

### 0026

| Check | Result |
|---|---|
| claims | 294 |
| claim_sources | 472 |
| evidence_assessments | 294 |
| claims without source | 0 |
| evidence approved (overlay A–F) | 27 |
| evidence review-required | 267 |
| Shop | unchanged |

Evidence levels were not rewritten after seed.

### 0027

| Check | Result |
|---|---|
| regulatory_records | 41 |
| regulatory_history | 0 |
| review_actions | 19 |
| Orforglipron | FOUNDAYO, NDA220934, US, current |
| Retatrutide | `clinical_development` |
| TB-500 vs TB4 | distinct substance ids |
| HCG / Ovitrelle | Ovitrelle EU row `is_current = false` |
| Shop | unchanged |

### 0028

SELECT policy `evidence_assessments_select_authenticated`: admin **or** (`review_status = approved` and parent claim approved). Writes remain admin-only (`insert`/`update`/`delete`). No anon INSERT/UPDATE/DELETE grants on that table.

### 0029

Manual `product_substances` plus unmap of `MT1` / `KL80`. Shop product fingerprint **unchanged**.

| Code | Slug | Method |
|---|---|---|
| RT5, RT10, RT20, RT30, RT40 | retatrutide | prefix |
| TR5, TR10 | tirzepatide | manual |
| SMO5 | sermorelin | manual |
| TA5 | thymosin-alpha-1 | manual |
| ML10 | melanotan-ii | manual |
| BBG70 | glow-blend | name |

Unmapped (no row): BT*, MT1, KL80, BB10, FR5, NSK30.

`product_substances` after 0029: **93**.

---

## Row counts (final)

| Entity | Count |
|---|---|
| substances | 27 |
| aliases | 46 |
| components | 3 |
| product_substances | 93 |
| research_runs | 2 |
| sources | 412 |
| source_substances | 468 |
| studies | 118 |
| study_substances | 123 |
| study_sources | 118 |
| claims | 294 |
| claim_sources | 472 |
| evidence_assessments | 294 |
| regulatory_records | 41 |
| regulatory_history | 0 |
| review_actions | 19 |

---

## Shop integrity

| Check | Before | After |
|---|---|---|
| products | 320 | 320 |
| products fingerprint | `89d1eb5b4c898f45d9fff41447e7f66e` | **same** |
| carts active | 2 | 2 |
| carts all | 6 | 6 |
| orders | 0 | 0 |

SKU, name, price, `is_active` included in the fingerprint. No shop column mutation.

---

## Auth integrity

2 `auth.users`, 1 admin `user_roles`, `has_role` still present. No auth schema migration.

---

## Foreign keys / orphans / duplicates

Orphan assessments: 0. Orphan claim_sources: 0. Duplicate PMID/DOI/study NCT/claim-source pairs/product-substance pairs: 0.

---

## RLS

Identity/science/claims/regulatory/review: authenticated SELECT (with status filters where designed); writes `has_role(..., 'admin')`. No anon INSERT/UPDATE/DELETE on the audited research tables.

---

## Hudson audit

| Surface | NCT07487363 / NCT07437560 as entities |
|---|---|
| sources | 0 |
| studies | 0 |
| study_sources | 0 |
| claim_sources (via source nct) | 0 |

Three **claim statements** (`*.summary.whatHasBeenStudied` on melanotan-ii, tb-500, thymosin-beta-4) still **mention** those NCTs in narrative. That matches Phase 2 (not stored as source/study rows). Not auto-corrected.

---

## JSON parity

| published.json expectation | Postgres | Result |
|---|---|---|
| 468 source attachments | 468 `source_substances` | MATCH |
| 123 study attachments | 123 `study_substances` | MATCH |
| 294 claims | 294 | MATCH |
| 41 regulatory | 41 | MATCH |
| 19 review actions | 19 | MATCH |
| 412 unique sources / 118 studies | 412 / 118 | MATCH |

---

## Tests / typecheck / lint / build

| Gate | Result |
|---|---|
| `npm test` | 360 passed / 30 files (first run: worker timeout flake on 2 files; retry green) |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 existing `react-refresh` warnings |
| `npm run build` | pass; catalog chunk ~348 kB |

---

## Regression (code + SQL)

Lexicon routes still import `catalog.ts` + `published.json`. `VITE_RESEARCH_DB_MODE` default `legacy`. Shop RPCs untouched. Product import tables not migrated. Calculator unchanged.

Logged-in browser QA of login/shop/cart was **not** executed in this phase (no session automation). Integrity is from SQL counts/fingerprint and local tests.

---

## Known issues

- Pre-apply dump is not a proven one-click Supabase restore.
- Client fuzzy mapper remains the lexicon mapping path until dual-read.
- Hudson NCTs appear only as narrative in three summary claims.
- 267 evidence assessments remain review-required.
- Two regulatory UNRESOLVED items from Phase 4 unchanged (oral semaglutide title; HCG/Ovitrelle non-current).
- Working tree still dirty (0025–0029 were already in the tree; live now matches them).
- Default table grants from 0015 may still give anon REFERENCES/TRIGGER/TRUNCATE; not DML write.

## Git

No commit. No push.

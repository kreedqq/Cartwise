# Migration 0030 realistic local validation (Phase 16A)

**Date:** 2026-08-29  
**Live project:** `cartwise-prod` (`cnjrjinvxycdkrmzcime`) — **not modified**  
**Production migration remains:** **0029**

## Verdict

**READY_WITH_RLS_LIMITATION**

The 0023 dump restored into isolated Docker Postgres 17, migrations 0024–0029 reproduced the live research baseline, 0030 applied cleanly, and Batch 03 intake imported **104 sources + 36 studies** as `review-required` with idempotency and transaction rollback. Shop (320 products, 0 orders) and auth (2 users) fingerprints did not change.

GoTrue-signed JWTs were **not** issued. `has_role(..., 'admin')` and RLS were exercised with `SET SESSION AUTHORIZATION authenticated` plus PostgREST-equivalent `request.jwt.claim.sub` GUCs against restored `auth.users` / `user_roles`. That is **not** a signed JWT. Per the Phase 16A rule, this is **not** `READY_TO_APPLY_0030`.

**Do not apply 0030 to production until explicitly asked.** No commit, push, deploy, Batch 04, community, or update engine in this phase.

Reproduce: `node scripts/phase-16a-realistic-local-validation.mjs`  
Machine JSON: `docs/snapshots/2026-08-29-phase-16a-local.json`

---

## 1. Backup

| | |
|---|---|
| File | `C:\Users\PolatMehmetErkan\Documents\cartwise-prod-backup\cartwise-prod-0023-2026-08-28-full.sql` |
| Present | yes |
| Size | **1230487** bytes |
| SHA-256 | `dae0ef581968cdd7a33eb5dc34c44064a0ff8fbfaa89a666b6e25d5897cb973a` |
| Expected | `dae0ef581968cdd7a33eb5dc34c44064a0ff8fbfaa89a666b6e25d5897cb973a` |
| Match | **yes** (case-insensitive) |

Hash matched, so validation continued. Dump is outside the git repo and was not committed.

---

## 2. Local database

Isolated Docker only. Image `postgres:17` (matches the dump origin, Supabase Postgres 17.x). Container name `peptix-16a-<timestamp>`, removed after the run. No connection to `cartwise-prod`, no Supabase project, no production URL.

An earlier postgres:16 attempt restored shop data but failed dump `GRANT … MAINTAIN` (Postgres 17 privilege) and `SET transaction_timeout`. The recorded run used postgres:17.

---

## 3. Restore

Roles created **before** restore: `supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`, `authenticated`, `anon`, `service_role`, `authenticator`, `dashboard_user`.

| | |
|---|---|
| Restore success | **yes** (`psql` exit 0, `ON_ERROR_STOP=0`) |
| Restore errors (postgres:17 + pre-created roles) | **0** |
| Missing roles | none |
| Missing extensions | none |
| Missing schemas | none |
| products | **320** |
| carts | **6** (all dump rows; backup docs: 2 were live-active at dump time) |
| orders | **0** |
| auth.users | **2** |
| price sum | 23925 |
| product fingerprint | `afd9f04bbf360fb5944709f30d653973` |

---

## 4. Supabase compatibility

With roles pre-created on postgres:17, the dump restored without missing-role / missing-extension / missing-schema errors.

Documented gaps that remain **even on a clean restore**:

| Gap | Relevant to 0024–0030? |
|---|---|
| Dump is not a Supabase Platform restore (no GoTrue, no PostgREST, no `authenticator` JWT switch) | **Yes for RLS JWT.** Policies and `auth.uid()` exist; signed JWTs do not. |
| `GRANT EXECUTE ON auth.uid()` in the dump is to `dashboard_user`, not `authenticated` | **Yes for GUC RLS.** Local validation granted `EXECUTE` on `auth.uid` / `auth.jwt` / `auth.role` / `auth.email` to `authenticated` and `anon` after restore so policies could call `auth.uid()`. Live PostgREST already has this. |
| Storage objects (S3) are not in the SQL dump | No |
| Vanilla postgres:16 `MAINTAIN` / `transaction_timeout` | No, if using PG17. Yes as a restore-portability note. |

0024–0030 themselves applied with `ON_ERROR_STOP=1` and **0** errors. They do not depend on missing extensions.

---

## 5. Apply 0024–0029 locally

Applied in order on the restored database. **Not production.**

| Migration | Result | Public research tables present after |
|---|---|---|
| 0024 | ok, 0 errors | `substances`, `product_substances` |
| 0025 | ok, 0 errors | + `sources`, `studies` |
| 0026 | ok, 0 errors | + `claims`, `evidence_assessments` |
| 0027 | ok, 0 errors | + `regulatory_records`, `review_actions` |
| 0028 | ok, 0 errors | same |
| 0029 | ok, 0 errors | same |

---

## 6. Baseline after 0029

| Object | Count | Expected |
|---|---|---|
| substances | 27 | 27 |
| sources | 412 | 412 |
| studies | 118 | 118 |
| claims | 294 | 294 |
| evidence_assessments | 294 | 294 |
| regulatory_records | 41 | 41 |
| review_actions | 19 | 19 |
| product_substances | 93 | 93 |
| products | 320 | 320 |
| orders | 0 | 0 |
| auth.users | 2 | 2 |

No STOP. Baseline matched production inventory.

---

## 7. Apply 0030

Applied only on the local container. Idempotent shape (`IF NOT EXISTS`, drop/recreate constraints and policies). No `DROP TABLE` / `TRUNCATE` / `DELETE FROM`. Shop/auth tables not referenced. Batch 03 is **not** inside 0030.

---

## 8. Schema validation after 0030 (before import)

| Check | Result |
|---|---|
| `sources.review_status` default | `'review-required'::text` |
| `studies.review_status` default | `'review-required'::text` |
| Existing sources | 412, all `approved`, 0 `review-required` |
| Existing studies | 118, all `approved`, 0 `review-required` |
| `sources.connector` | present |
| `studies.intervention` / `condition` | present |
| Indexes | `sources_review_status_idx`, `studies_review_status_idx` |
| FKs on sources/studies/junctions | 6 |
| Triggers | `sources_set_updated_at`, `studies_set_updated_at` |
| `review_actions` entity_type | includes `source` and `study` |
| Anon grants on `sources` | **none** (`REVOKE ALL`) |
| SELECT policies | `sources_select_authenticated`, `studies_select_authenticated` (admin or approved) |

---

## 9. Existing data after 0030

412 sources and 118 studies still present. All existing rows `review_status = approved`.

---

## 10–12. Public visibility, RLS, `has_role`

Restored roles:

- Admin (+ `user`): `f0dc82df-7f75-4838-86c6-1e7161c7fa7b`
- Non-admin `user` only: `57b2e127-5034-4967-bcdc-7e4f0ddd4475`

`public.has_role(admin, 'admin')` = true; `has_role(non-admin, 'admin')` = false → **PASS** (function against restored `user_roles`, `SECURITY DEFINER`).

RLS method: `SET SESSION AUTHORIZATION authenticated` + `request.jwt.claim.sub` / `request.jwt.claims` GUC (how PostgREST exposes `auth.uid()`). **GoTrue-signed JWT: NOT TESTED.**

After Batch 03 import:

| Role | review-required sources | approved sources | review-required studies | approved studies | review-required evidence | review_actions |
|---|---|---|---|---|---|---|
| anon (`has_table_privilege` SELECT) | no SELECT on sources/studies/claims/evidence/`review_actions` | | | | | |
| authenticated non-admin | **0** | 412 | **0** | 118 | **0** | **0** |
| authenticated admin | **104** | (all) | **36** | (all) | (admin sees all) | 19 |

Non-admin `INSERT` into `review_actions`: **DENIED** (RLS policy).

| Item | Status |
|---|---|
| Anon cannot read research | PASS (privilege revoke) |
| Authenticated non-admin sees only approved research | PASS (GUC) |
| Admin sees review-required | PASS (GUC) |
| `has_role` | PASS |
| Signed JWT / GoTrue | **NOT TESTED** |

---

## 13–17. Batch 03 import

SQL generated from `renderBatch03IntakeSql(buildBatch03IntakePlan(analysis.json))` (`scripts/write-batch03-import-sql.ts`). Applied only to the local 0030 database.

| | Run 1 | Run 2 |
|---|---|---|
| New sources | **104** (412 → 516) | **0** (516 → 516) |
| New studies | **36** (118 → 154) | **0** (154 → 154) |
| New `review_status` | sources 104 `review-required`; studies 36 `review-required` | unchanged |
| Existing approved | 412 sources, 118 studies | unchanged |

Relationship-only PMIDs `42578445`, `42419792`, `40353578`, `40544433`: **4 rows / 4 distinct** (not duplicated).

Hudson `NCT07487363` / `NCT07437560`: **0** sources, **0** studies.

---

## 18. Failure rollback

Controlled failure: `BEGIN`; insert valid probe PMID `99999991`; insert empty title (violates `sources_title_check`); transaction aborted.

After abort: probe **0**, bad row **0**, sources still **516**. No half-finished records. Production not touched.

---

## 19. Public lexicon

Client `fetchPublicLexicon` SELECTs sources/studies with `.eq(review_status, approved)` and claims/evidence already approved-only.

After intake, global:

- Public-eligible sources: **412** approved (104 Batch 03 hidden)
- Public-eligible studies: **118** approved (36 Batch 03 hidden)

Per-slug (list/detail identity still distinct):

| Slug | Approved sources | Review-required sources | Approved studies | Review-required studies |
|---|---|---|---|---|
| retatrutide | 28 | 11 | 12 | 6 |
| tirzepatide | 30 | 9 | 12 | 4 |
| semaglutide | 34 | 13 | 12 | 5 |
| orforglipron | 29 | 6 | 12 | 4 |
| tb-500 | 13 | 1 | 0 | 0 |
| thymosin-beta-4 | 22 | 6 | 12 | 5 |

SPA was not pointed at this Docker instance. Visibility is from SQL + the existing client filters. Production lexicon was not requested and was not changed.

---

## 20. Admin Research

Local queue counts after import:

- Sources tab candidates: **104** UUID rows, `review-required`
- Studies tab candidates: **36** UUID rows, `review-required`

`submitAdminReview` for `kind: source|study` inserts `review_actions` then updates `review_status`. Approve/Reject stay disabled for `intake:` placeholder IDs; after persist they use real UUIDs.

The React Admin UI was **not** driven against this container (no local GoTrue). Counts match the intended tabs. **No review action was left committed.**

---

## 21. Approval test

Local transaction only (rolled back):

- Insert `review_actions` + set one source to `approved` → in-tx review-required sources 103
- `ROLLBACK` → probe actions **0**, sources review-required **104**, `review_actions` **19**

Code path (`src/services/adminResearch.ts` `submitAdminReview`): insert then update, no auto-approve. RLS: non-admin insert denied (above). Production unchanged.

---

## 22. Shop safety

| | After restore | After 0030 + intake |
|---|---|---|
| products | 320 | 320 |
| orders | 0 | 0 |
| carts | 6 | 6 |
| price sum | 23925 | 23925 |
| product fingerprint | `afd9f04bbf360fb5944709f30d653973` | same |
| cart fingerprint | `2afb3aa49c3c2015061eb3c44441791f` | same |

---

## 23. Auth safety

| | After restore | After 0030 + intake |
|---|---|---|
| auth.users | 2 | 2 |
| user fingerprint | `76af77941b50c8bc6ff620fc81e9ac50` | same |

No users deleted. No roles changed.

---

## 24. Identity

| Check | Result |
|---|---|
| TB-500 ≠ Thymosin Beta-4 | two rows (`TB-500`, `Thymosin Beta-4`), distinct ids |
| Melanotan II ≠ Afamelanotide | name `Melanotan II`; no afamelanotide alias on that substance |
| IGF-1 LR3 ≠ Mecasermin | name `IGF-1 LR3`; not named mecasermin |
| Glow Blend = Blend | `molecule_type` = `blend`, `status` = `blend` |

---

## 25–28. Claims, evidence, regulatory, mappings

| Object | After intake | Notes |
|---|---|---|
| claims | **294** | no new claims |
| evidence_assessments | **294** | **267** still `review-required`; no auto-change |
| regulatory_records | **41** | unchanged |
| product_substances | **93** | unchanged by 0030/import |
| review_actions | **19** | no automatic review writes |

---

## 29. Public lexicon regression

Retatrutide, Tirzepatide, Semaglutide, Orforglipron, TB-500, and Thymosin Beta-4 all still have approved source rows for list/detail. Batch 03 rows on those slugs stay `review-required` (hidden). TB-500 remains a separate identity from Thymosin Beta-4.

Browser list/detail against production was not part of this local-DB phase.

---

## 30. Tests

| Gate | Result |
|---|---|
| `npm test` | **452 passed** / 37 files |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 existing `react-refresh/only-export-components` warnings |
| `npm run build` | pass |

Existing tests were not deleted.

---

## 31. Production / git

| Action | Done? |
|---|---|
| Production DB | **no** |
| Production 0030 | **no** |
| Production seed/import | **no** |
| Deploy | **no** |
| Commit | **no** |
| Push | **no** |
| Batch 04 / community / update engine | **no** |

---

## Known limitations

1. **GoTrue-signed JWT not tested.** RLS PASS above is GUC + `SET SESSION AUTHORIZATION`, not a browser/PostgREST JWT. Verdict cannot be `READY_TO_APPLY_0030`.
2. Admin Research React UI was not attached to the ephemeral database.
3. Public lexicon pages were not opened in a browser against Docker; SQL + client filters were used.
4. `GRANT EXECUTE` on `auth.uid()` was added locally after restore because the dump grants it to `dashboard_user`. Live Supabase already exposes this to the API roles.
5. Container is destroyed after the script; this is not a standing local Supabase stack.
6. `BATCH03_PRODUCTION_IMPORT_PENDING` remains `true` in app code until a future approved production import.

---

## Final verdict

**READY_WITH_RLS_LIMITATION**

0023 restore sufficient · 0024–0029 correct · 0030 correct · 104/36 intake correct · Hudson excluded · idempotency pass · rollback pass · public/admin visibility pass under GUC RLS · shop/auth unchanged · tests pass · **signed JWT NOT TESTED**.

# Research Persistence Phase 4

**Date:** 2026-08-28  
**Scope:** `regulatory_records`, `regulatory_history`, `review_actions`.  
**Baseline:** `60131c0` + uncommitted Phase 2 + Phase 3.  
**No git commit.** Lexicon still reads `catalog.ts` + `published.json`.

## Migration

`supabase/migrations/0027_research_regulatory_and_review.sql`  
Generator: `scripts/generate-phase4-sql.mjs` from `published.json` **regulatory** sources only.

No shop/auth/checkout changes. No `community_reports`. No Batch 03. No lexicon switch. Phase 3 evidence assessment statuses are **not** rewritten.

## Tables

| Table | Purpose |
|---|---|
| `regulatory_records` | Regional regulatory state for a substance + product/source |
| `regulatory_history` | Append-only status/indication changes (trigger on update) |
| `review_actions` | Append-only admin/research review trail |

### Regulatory record fields used

`stable_key`, `substance_id`, `authority`, `region`, `status`, `indication`, `product_name`, `application_id`, `source_id`, `effective_date`, `last_checked`, `is_current`, `note`, `review_status`, timestamps.

`is_current = false` for related/non-identical products (Ovitrelle vs urinary hCG). Public SELECT (authenticated) only sees **current + approved**. Admins see all.

Empty FDA/EMA search is **never** stored as `not_approved`. Overlay `clinical-development` / `investigational` / `insufficient` is copied onto the no-match row.

### Regulatory history

No published transitions exist, so **0** history rows are imported. Later `UPDATE` of status/indication/`is_current` writes a history row. Parent delete is `RESTRICT`.

### Review actions

Polymorphic `entity_type` + `entity_id` / `entity_stable_key` (no FK on `entity_id`). Types: claim, evidence_assessment, regulatory_record, research_update, substance.

Actions: approve, reject, request_review, edit, publish, unpublish.

Client policies: SELECT + INSERT for `has_role(..., 'admin')` only. **No UPDATE/DELETE policies.** A later decision is a new row. `admin_user_id` references `auth.users` (nullable; import has no invented admins).

Seed: published `reviewItems` → `request_review` on the substance, `admin_user_id` null.

Admin Research UI still reads `published.json` `reviewItems`. This table prepares the queue; the page is not switched.

## Import counts

| | Count |
|---|---|
| Regulatory sources in published.json | 41 |
| `regulatory_records` | 41 |
| Current | 40 |
| Historical / non-current | 1 (Ovitrelle related) |
| `regulatory_history` | 0 |
| `review_actions` (`request_review`) | 19 |
| Authorities present | FDA, EMA |
| Authorities absent | BfArM, MHRA, NMPA (no published sources) |
| Regions | US, EU |
| `not_approved` rows | 0 |
| Records `review-required` | 2 |
| Duplicate source inserts | 0 (join existing `sources.legacy_ids`) |

## JSON vs Postgres (per regulatory source)

| Status | Count |
|---|---|
| MATCH | 39 |
| MISSING_IN_POSTGRES | 0 |
| MISSING_IN_JSON | 0 |
| DIFFERENT | 0 |
| UNRESOLVED | 2 |

UNRESOLVED:

- `hcg:ema-ovitrelle` — related recombinant, not current urinary hCG EU approval
- `semaglutide:fda-semaglutide-27f15fac` — DailyMed title “OZEMPIC (ORAL SEMAGLUTIDE)” vs identityNote oral tablets NDA213051; imported `review-required`

## Named substances

| Substance | Stored state |
|---|---|
| Orforglipron | Current US `approved_specific_indication`, product FOUNDAYO, `NDA220934`. No EMA row (connector unavailable). |
| Retatrutide | `clinical_development` from fda-none; not approved |
| Tirzepatide | US Mounjaro NDA215866, US Zepbound NDA217806, EU Mounjaro EPAR |
| Semaglutide | US Ozempic NDA209637 (two DailyMed setids), oral NDA213051 review-required, EU Ozempic + Wegovy EPARs |
| Liraglutide | Three US generic labels + EU Victoza + Saxenda; approvals not copied across products; no invented NDAs |
| Tesamorelin | US EGRIFTA SV, BLA022505, HIV-lipodystrophy indication from identityNote (not general weight loss) |
| Somatropin | US Norditropin BLA021148, Omnitrope, Serostim; EU Omnitrope EPAR only (Norditropin EPAR 404 not invented) |
| hCG | US urinary Chorionic Gonadotropin BLA017067 current; Ovitrelle not current |
| TB-500 | insufficient_information; separate source from Thymosin Beta-4 (`clinical_development`) |
| Glow-blend | insufficient_information; not an INN |

Indication is null except Tesamorelin (only structured indication in published notes). Application IDs only when identityNote names them next to that product.

## Evidence vs regulatory

Independent. Phase 3: 294 assessments, 27 overlay A–F, 267 `review-required`. Phase 4 does not approve those 267 or change A–F.

Community remains unavailable. No community evidence.

## RLS / indexes / FKs

- Records: authenticated SELECT of current approved; admin write
- History: admin or parent current+approved; admin insert; trigger is `SECURITY DEFINER`
- Review: admin select/insert only
- FKs: substances RESTRICT, sources RESTRICT, history → records RESTRICT, `admin_user_id` → `auth.users` RESTRICT
- Indexes: substance+region, authority, status, source, current partial, review entity, created_at

## Tests

`src/tests/researchPersistencePhase4.test.ts`. Existing tests kept.

## Known issues

- 0027 is not applied to live Supabase until migrations 0024–0026 are applied first.
- Admin Research UI still uses `published.json`.
- Oral Semaglutide DailyMed title vs NDA213051 remains UNRESOLVED / review-required.
- Ovitrelle remains a related non-current record, not a second hCG identity row (catalog still has one `hcg` slug).
- BfArM / MHRA / NMPA have no imported records.
- Lexicon remains on files.

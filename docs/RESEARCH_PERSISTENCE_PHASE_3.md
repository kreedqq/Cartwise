# Research Persistence Phase 3

**Date:** 2026-08-28  
**Scope:** claims, claim_sources, evidence_assessments.  
**Baseline:** `60131c0` + uncommitted Phase 2.  
**No git commit.** Lexicon still reads `catalog.ts` + `published.json`.

## Migration

`supabase/migrations/0026_research_claims_and_evidence.sql`  
Generator: `scripts/generate-phase3-sql.mjs` from `published.json` cited blocks only.

No shop changes. No `regulatory_records`. No `community_reports`. Summary paragraphs are **not** split.

## Tables

| Table | Purpose |
|---|---|
| `claims` | One scientific statement; `stable_key` independent of text |
| `claim_sources` | Claim ↔ source; optional `study_id` when the cited source has an NCT |
| `evidence_assessments` | 1:1 with claim; A–F is **not** stored on `claims` |

`claims.substance_id` is enough (each published block belongs to one profile). No `claim_substances`.

Versioning: `created_at`, `updated_at`, `status`, nullable `supersedes_claim_id`. A separate `claim_versions` table is **not** implemented in Phase 3.

### RLS

Authenticated SELECT of **approved** claims (admins see all statuses). Write via existing `has_role(..., 'admin')`.

## Extraction

Legacy cited blocks imported 1:1:

| Slot | Count | `claim_type` |
|---|---|---|
| summary (8 × 27) | 216 | mechanism / effect / safety / clinical_evidence / current_research / other |
| safetyItems | 42 | safety (+ `safety_category`) |
| interactions | 27 | safety / interaction |
| reconstitution | 7 | other |
| conflicts | 2 | other |
| pharmacology[] | 0 | — |

**Legacy paragraphs:** 294  
**Extracted claims:** 294  
**Claims with sources:** 294  
**Claims without sources:** 0  
**Claim status review-required:** 0  
**Evidence assessments:** 294 (27 with published overlay A–F on `humanEvidence`; 267 `review-required` without invented claim-level A–F)

## Source / study links

472 `claim_sources` rows. NCT on the cited source sets optional `study_id`. No studies invented.

## Hudson

NCT07487363 and NCT07437560: **0** claim hits. Not imported. Raw cache unchanged.

## JSON vs Postgres

| Status | Count |
|---|---|
| MATCH | 294 |
| MISSING_IN_POSTGRES | 0 |
| MISSING_IN_JSON | 0 |
| UNRESOLVED | 0 |

Duplicates: exact same text on the same substance in **different slots** is kept separate (`duplicatesKeptSeparate` counts those groups). No aggressive semantic merge.

## Evidence rules

- A–F copied only onto `summary.humanEvidence` from the published **substance overlay** (existing classification, not a new reassessment).
- Confidence copied only with that overlay, not derived from A–F by formula.
- `safetyItems.domain` maps to human / animal / in_vitro / mechanistic.
- Community types cannot be stored as `evidence_type`.

## Tests

`src/tests/researchPersistencePhase3.test.ts`. Existing tests kept.

## Known issues

- 0026 is in Git; applying to live Supabase is a separate step (requires 0024–0025 applied first).
- Claim-level A–F is not reconstructed for mechanism/safety/preclinical slots (review-required assessments).
- Admin Research UI still reads `published.json` `reviewItems`; Postgres `review-required` is identifiable by column but the page was not rebuilt.
- Pharmacology numeric rows were empty in published.json; no PK numbers invented.
- Lexicon remains on files.

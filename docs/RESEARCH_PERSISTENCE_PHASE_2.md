# Research Persistence Phase 2

**Date:** 2026-08-28  
**Scope:** sources, studies, research runs, and mapping tables only.  
**Baseline:** `60131c0`  
**No git commit.** Lexicon still reads `catalog.ts` + `published.json`.  
**Import source:** validated `published.json` only (not raw `src/research/cache/fetched/`).

## Migration

`supabase/migrations/0025_research_sources_studies_runs.sql`  
Seed generator: `scripts/generate-phase2-sql.mjs` (rebuilds the jsonb payload from `published.json`).

Does **not** ALTER shop tables. Does **not** create `claims`, `evidence_assessments`, `regulatory_records`, or `community_reports`.

## Tables

| Table | Purpose | Delete |
|---|---|---|
| `research_runs` | Traceable import/execution | n/a |
| `research_run_sources` | Which run accepted which source | RESTRICT both ways |
| `sources` | Canonical scientific source | n/a |
| `source_substances` | Source ↔ substance (many-to-many) | RESTRICT |
| `studies` | Unique NCT study | n/a |
| `study_substances` | Study ↔ substance | RESTRICT |
| `study_sources` | Study ↔ bibliographic/registry source | RESTRICT |

### Columns of note

- `sources.status`: `active` \| `superseded` \| `unavailable` \| `rejected` (lifecycle, **not** evidence A–F)
- `sources.source_type`: includes `fda` / `ema` / `bfarm` / `mhra` inferred from URL when published type is `regulatory`; otherwise published types (`pubmed`, `clinical_trial`, `review`, `meta_analysis`, `scientific`, …). Community types are not stored.
- `sources.doi` normalized (lowercase, no `doi:` / `doi.org` prefix)
- `sources.pmid` digits only
- `sources.nct_id` / `studies.nct_id` uppercase `NCT########`
- No URL unique constraint
- `research_runs.started_at` / `completed_at` **null** on historical imports (not invented)

### Indexes

Unique partial: `sources.pmid`, `sources.doi`, `sources.nct_id` (where not null). Unique `studies.nct_id`.  
B-tree: `sources.source_type`, `sources.publication_date`, `studies.status`, `studies.phase`, `research_runs.connector`, `research_runs.started_at`, FK sides.

### RLS

Authenticated SELECT. Sources: non-admins only `status = 'active'`.  
Admin INSERT/UPDATE/DELETE via existing `has_role(..., 'admin')`. Service-role grants match 0015/0024.

## Imported from published.json

| Metric | JSON nested rows | Postgres unique | Links |
|---|---|---|---|
| Sources | 468 | **412** | 468 `source_substances` |
| Studies | 123 | **118** | 123 `study_substances` |
| Study ↔ source | — | **118** | one registry source per NCT |
| Research runs | — | **2** historical_import | batch-01 + batch-02 |

Batch 02 unique accepted sources **125** and NCT studies **25** match `docs/RESEARCH_BATCH_02_REPORT.md`.  
Batch 01 unique sources **288**, studies **93** (JSON nested 343 / 98; extras are the same paper/NCT on several Batch 01 slugs).

### Dedup

Priority: PMID → DOI → NCT → published source `id`. Not title. Shared GLP-1 papers (e.g. PMID 40988099) become one `sources` row with multiple `source_substances`.

### Rejected / Hudson

From **published.json**: 0 rejected sources, 0 rejected studies (already compiled out).  
Explicitly **not imported** (remain in raw cache only):

- NCT07487363 (Hudson / fictional CT.gov example; TB-500 / TB4 queries)
- NCT07437560 (Hudson Biotech; Melanotan II)

No fake sources stored as `status = rejected` in Phase 2.

### Substance mapping

- Retatrutide / LY3437943 stay on `retatrutide`
- TB-500 has **no** published NCT studies; Thymosin Beta-4 has its own studies
- Melanotan II sources are not Afamelanotide/Scenesse papers
- IGF-1 LR3 sources are not Mecasermin/Increlex papers
- Glow Blend sources attach to `glow-blend`, not as a fake INN and not auto-copied onto components

## Dual read

`VITE_RESEARCH_DB_MODE` still `legacy` by default. `lexiconUsesPostgresScience()` exists; lexicon pages do **not** call it.

## Reconciliation (published.json vs seed)

| Status | Result |
|---|---|
| MATCH | 468 source attachments, 123 study attachments |
| MISSING_IN_POSTGRES | 0 |
| MISSING_IN_JSON | 0 |
| UNRESOLVED | 0 |
| DIFFERENT | none required; merged rows keep the first title |

## Tests

`src/tests/researchPersistencePhase2.test.ts` plus existing lexicon/shop tests. Existing tests not removed.

## Known issues

- Migration 0025 is in Git; applying it to a live Supabase project is a separate operator step.
- Historical runs have null `started_at` / `completed_at` and do not replay connector HTTP logs.
- Search-count `scientific` sources stay per published id (not merged by URL).
- FDA/EMA rows are `sources`, not `regulatory_records` (Phase 3+).
- Claims, evidence A–F, community remain in `published.json` only.
- Client `/^MT2?/i` vs SQL identity prefix tightness is unchanged from Phase 1.

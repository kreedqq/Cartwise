# Research Update Engine (Block 2)

Verdict: **RESEARCH_UPDATE_ENGINE_READY_WITH_LIMITATIONS**

Date: 2026-08-29. Engine core is in `src/lib/peptide/research/updateEngine/`. It does **not** auto-publish. It does **not** apply production migrations. It does **not** write Postgres. Cron stays off.

Live production remains **0030** (27 / 516 / 154 / 294 / 294 / 41 / 19 / 93). Batch 03 review-required rows are unchanged. Shop, auth, cart, orders, and Batch 04 are untouched.

## Architecture

```
Research Update Engine (in-memory core)
  ├── PubMed Connector
  ├── ClinicalTrials.gov Connector
  ├── FDA Connector
  ├── EMA Connector
  ├── BfArM Connector     (unavailable)
  ├── MHRA Connector      (unavailable)
  ├── NMPA Connector      (unavailable)
  └── Community layer     (architecture only; unavailable)

runResearchUpdate(scope × connectors)
  → normalize → identity match → Hudson exclude → change detection
  → review candidates (review-required)
  → persist plan (productionWrite: false)
```

Connectors are independent: one failure does not abort the others. The run status becomes `partial` when at least one connector succeeds and at least one fails.

Browser stubs in `src/research/connectors/` remain unavailable (no live keys in the client). Node fetch scripts (`scripts/fetch-research-sources.mjs` and regulatory fetch) stay the live HTTP path. The engine **reuses** identity filters (`keepStudy` / `keepArticle` / `isExcludedNct`) instead of duplicating PubMed/CT.gov/openFDA HTTP clients.

Layers of truth:

| Layer | Role |
|---|---|
| Raw API responses | Research cache (`src/research/cache/fetched/`) |
| Normalized candidates | Engine result (this phase, in memory) |
| Postgres | Public research source of truth (approved rows) |
| Public lexicon | Approved only |

Cache is not a public source of truth.

## Connector contract

Every connector implements `UpdateEngineConnector`: `id`, `label`, `kind`, `availability`, `search`, `normalize`, `validate`. Connectors never decide public approval.

Required fields on `ConnectorSourceRecord`:

- source / source type
- identifier
- title
- url
- publisher
- publication date
- substance candidate
- raw metadata
- retrieved at
- connector

Optional: study, NCT, DOI, PMID, regulatory authority, region.

Scientific ids: `pubmed`, `clinicaltrials`, `fda`, `ema`, `bfarm`, `mhra`, `nmpa`.  
Community ids (architecture only): `reddit`, `forum`, `blog`, `user-report`.

## Research runs

`runResearchUpdate` produces:

- `id`, `startedAt`, `completedAt`
- `status`: queued | running | completed | partial | failed | cancelled
- `trigger`: manual | scheduled | single-substance | single-connector | full
- substance scope + connector scope
- statistics
- review candidates
- retrieval logs (`ResearchRunLog`: run, source identifier, connector, retrieval status, retrieved timestamp, error)

Logs must not contain API keys. Engine logs use `error_text`-style messages only.

Prepared SQL `supabase/migrations/0031_research_update_engine_runs.sql` extends `research_runs` / `research_run_sources` for `partial`, `trigger_kind`, scopes, `statistics`, and retrieval columns. **PREPARED — do not apply.** Production stays on 0030.

## Scope

`resolveScope`:

| Mode | Example |
|---|---|
| All substances × available connectors | Update All (27 identity slugs, not shop products) |
| Single substance | Retatrutide × PubMed, CT.gov, FDA, EMA |
| Single connector | PubMed × all 27 substances |
| Substance + connector | Retatrutide + ClinicalTrials.gov |

Available scientific connectors in this phase: PubMed, ClinicalTrials.gov, FDA, EMA. BfArM, MHRA, NMPA are structured but `unavailable`.

Update All means substances × scientific connectors. It never scans shop `products`.

## Normalization

PubMed: substance query payload → PMID, DOI, title, authors, journal, publication date, URL.  
ClinicalTrials.gov: NCT, title, sponsor, intervention, condition, phase, status, dates.  
FDA: authority, product, indication, region `US`, status, source, date. Empty search is **not** `not_approved`.  
EMA: product, authority, region `EU`, status, indication, date, source. HTTP 404 is **not** stored as regulatory evidence.

Dedup keys, in priority order: PMID → DOI → NCT → stable key (`connector:identifier`).

## Deduplication and change detection

| Disposition | Meaning |
|---|---|
| NEW | No matching PMID/DOI/NCT/stable key |
| UPDATED | Same identity, title or date changed |
| UNCHANGED | Same identity and comparable fields |
| DUPLICATE | Same key already seen in this run |
| REVIEW_REQUIRED | Uncertain identity / query pollution |
| REJECTED | Hudson, identity forbidden, validate fail |

The same run twice against the same existing catalog yields UNCHANGED, not a second NEW row.

Diff payload on candidates: previous title/date vs new title/date, substance slug, source key, review reason.

## Identity

Matching uses slug, aliases, CAS, known names, and connector metadata via `keepStudy` / `keepArticle`. Uncertain matches become REVIEW_REQUIRED.

Never auto-merge:

- TB-500 ≠ Thymosin Beta-4
- Melanotan II ≠ afamelanotide
- IGF-1 LR3 ≠ mecasermin
- Glow Blend ≠ unique INNs (GHK-Cu / TB-500 / BPC-157)
- Urinary hCG ≠ recombinant choriogonadotropin alfa (Ovitrelle)

## Hudson

`NCT07487363` and `NCT07437560` are always REJECTED / EXCLUDED. They never become a source, study, claim, or evidence candidate.

## Review intake

NEW, UPDATED, and REVIEW_REQUIRED candidates are `review-required`. The persist plan sets `autoApprove: false`, `claimsAdded: 0`, `evidenceUpgraded: 0`, `regulatoryAutoApproved: 0`, `productionWrite: false`.

Claims stay an admin workflow. Evidence A–F is not upgraded. Regulatory region is preserved (US is not rewritten as global approved).

## Public visibility

Only `approved` may appear in the public lexicon (`isPublicSource` / `isPublicStudy`). `review-required` and `rejected` stay hidden. Engine candidates are not public.

## RLS

Unchanged from 0030: non-admin SELECT on sources/studies is approved-only. The engine does not open a new write path. 0031 (unapplied) only extends run logging columns.

## Cache

Existing research cache may hold raw responses. Normalized output is intended for Postgres after a future persist phase. Approved rows remain the public lexicon.

## Errors and rate limits

Connector failure → log + continue. Mixed success/failure → `partial`. All fail → `failed`. All succeed → `completed`.

`withRateLimit`: minimum interval, backoff, retry on 429 / 503 / 500 only. No aggressive loops.

## Community boundary

Community is a separate connector kind. Reddit / forums / blogs / user-report stay unavailable. No scraping. Community cannot raise scientific evidence (`communityCannotRaiseEvidence`).

## Schedule

Kinds exist: manual, daily, weekly, monthly. `UPDATE_ENGINE_CRON_ENABLED = false`. No cron job is activated.

## Admin API (core)

`startEngineRun` actions: `update-all` | `update-substance` | `update-connector`. Capabilities report cron off and production write off. Admin Research shows a status line only; it does not launch live HTTP runs from the browser.

## Security

API keys are never logged, never stored in DB by this engine, and never added to the client bundle. Documented env **names** only (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; optional later `PUBMED_API_KEY` on the server).

## Production safety

- No production migration apply
- No production data change
- No production import
- No deploy, commit, or push
- No Batch 04
- No community data

## Limitations

1. Candidates stay in memory; Postgres persist is not wired.
2. Migration 0031 is prepared only.
3. Live HTTP remains Node scripts; engine adapters are injectable (tests use TEST FIXTURES).
4. Cron disabled.
5. BfArM / MHRA / NMPA unavailable.
6. Community not implemented.
7. Admin UI does not start live runs.
8. Browser connectors remain stubs (no duplicate live client fetch).

## Tests

`src/tests/researchUpdateEngineBlock2.test.ts` covers connector contract, PubMed/CT.gov/FDA/EMA normalization, duplicate/change detection, identity, Hudson, review status, runs, partial runs, retry, idempotency, substance/connector scope, public visibility, community separation, and prepared 0031. Fixtures are marked TEST FIXTURES and are not production rows.

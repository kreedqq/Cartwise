# Research Operations (Block 3)

Verdict: **RESEARCH_OPERATIONS_READY_WITH_LIMITATIONS**

Date: 2026-08-29. Extends the Block 2 update engine into a research operations layer: persistent runs (in-memory store + prepared SQL), Admin Update All / Substance / Connector / combined scope, review-candidate persist, cancel / retry / concurrency, connector health, and a separate community architecture.

Live production remains **0030**. `supabase/migrations/0031_research_operations.sql` is **MIGRATION_REQUIRED** and **not applied**. No production write, deploy, commit, push, Batch 04, or community import.

## Research runs

`startPersistedRun` writes a run into the operations store before work starts:

- id (UUID)
- started_at / completed_at
- status: queued | running | completed | partial | failed | cancelled
- trigger: manual | scheduled | single-substance | single-connector | full
- substance scope + connector scope
- statistics
- error summary (no secrets)

Prepared 0031 adds the same columns to `research_runs` plus `progress`, `schedule_kind`, `cancel_requested`, `parent_run_id`, and a unique index so only one full run can be queued/running.

## Persistence

Runs are no longer engine-only memory objects. The operations store keeps run history, retrieval logs, and review-required sources/studies from completed or partial runs.

Until 0031 is applied, the store is the **session store** (`getSessionOperationsStore`). A full browser reload without 0031 cannot recover history. That is the main durability limitation.

Cancelled runs do **not** persist review candidates (no half-finished review states). Completed / partial runs persist NEW / UPDATED / REVIEW_REQUIRED as `review-required`. UNCHANGED / DUPLICATE / REJECTED do not insert new rows.

## Update All / scopes

| Action | Meaning |
|---|---|
| Update All | 27 identity substances × PubMed, CT.gov, FDA, EMA |
| Update Substance | one slug × available scientific connectors |
| Update Connector | all 27 slugs × one connector |
| Combined | one slug × one connector |

Update All never scans shop products. BfArM / MHRA / NMPA stay unavailable and produce no rows. Browser Update All reads the official research **cache** (Batch 03 JSON). It does not call live NCBI/CT.gov/FDA/EMA from the client and does not invent data.

## Run history, progress, cancel, retry

Admin Research shows run id, date, trigger, scope, status, source/study counts, review candidates, errors, with pagination.

While a run is active: status, connector, substance, sources checked, new / updated / unchanged / duplicate / review required.

Cancel sets `cancel_requested` and stops further connector pairs. Already-persisted earlier runs stay. The cancelled run does not write new review-required rows.

Retry is allowed for `partial` and `failed` only. Same scope, `parent_run_id` set. Dedup uses the existing catalog so UNCHANGED is not inserted again.

## Concurrency

A second **full** run is blocked while one is queued or running. 0031 encodes this as `research_runs_one_active_full`.

## Change detection and diffs

Same dispositions as Block 2. UPDATED stores previous and current title/date/status on the run log so Admin can show Previous / Current / Source / Substance / Connector / Date.

## Review intake and approval

New/updated/uncertain sources and studies: `review-required`. `sources.status` (lifecycle) and `studies.status` (CT.gov) stay separate from `review_status`.

Approve / Reject require a persisted UUID. Intake placeholders and invalid ids are rejected.

Approve of a source or study changes **only** that row's `review_status` and appends `review_actions` (admin, entity, action, timestamp, reason). No automatic claims, evidence A–F upgrade, or regulatory approval.

Frozen inventory in the operations store: claims 294, evidence 294 (267 review-required / 27 approved), regulatory 41.

## Admin UI

`ResearchOperationsPanel` on `/admin/research`:

- Update All / Update Substance / Update Connector / Substance + Connector
- Progress + summary
- Run history
- Connector health (available / unavailable, last success, last error, last checked)
- Review candidate counts from the dashboard

## Connector health

Available: PubMed, ClinicalTrials.gov, FDA, EMA.  
Unavailable: BfArM, MHRA, NMPA, Reddit, forum, blog, user-report.

Logs never include API keys.

## Community architecture

Prepared `community_reports`: id, substance, kind (`reddit` | `forum` | `blog` | `user-report`), title, summary, URL, optional public author identifier, dates, `review_status` (default review-required), metadata without PII.

Reddit remains **unavailable**. No scraping. No mock posts. No community import.

Community cannot raise scientific evidence, claims, or regulatory status. Public lexicon may show community only as a separate approved section; today it stays the unavailable disclaimer.

## RLS

0031 (unapplied): admin sees all community / connector-health rows; authenticated non-admin sees approved community only; anon has no grant. Existing 0030 source/study policies remain: public/authenticated approved only; admin sees review-required and rejected.

## Security

No API keys, tokens, or credentials in logs, database columns, or the client bundle. Error text is redacted for `api_key` / `bearer` / `token` / `secret` / `authorization`.

## Cron

`daily` / `weekly` / `monthly` columns exist. `OPERATIONS_CRON_ENABLED = false`. Scheduled starts are not activated.

## Failure handling

Connector failure → continue others → run `partial`. All fail → `failed`. Cancel → `cancelled` without candidate persist.

## Limitations

1. 0031 not applied; production DB stays 0030.
2. Session store is not durable across a full reload until 0031.
3. Admin Update All uses official cache, not live HTTP.
4. Engine does not write `regulatory_records`.
5. Community table is empty by design.
6. Cron disabled.

## Tests

`src/tests/researchOperationsBlock3.test.ts` (TEST FIXTURES only).

# Admin Research → Postgres (Phase 8)

**Date:** 2026-08-28  
**Verdict:** **ADMIN_POSTGRES_READY**  
**Public lexicon:** still `catalog.ts` + `published.json` (legacy). No switch.  
**Git:** no commit, no push.

## Admin architecture

```
/admin/research (AdminRoute)
  ├─ Dashboard counts     → Postgres COUNT (head)
  ├─ Review queue         → paginated Postgres
  ├─ Review detail        → one claim/evidence/regulatory + sources/studies
  ├─ Review actions       → INSERT review_actions, then UPDATE entity status
  ├─ Product mapping      → product_substances + products(code, name) only
  ├─ Dual-read panel      → unchanged (opt-in VITE_RESEARCH_DB_MODE=dual)
  └─ Legacy fallback      → published.json, only when Postgres fails and admin opts in
```

Public `/peptide/lexikon` is unchanged.

## Postgres read

Tables used (exist on live 0024–0029):

`substances`, `sources`, `studies`, `claims`, `claim_sources`, `evidence_assessments`, `regulatory_records`, `review_actions`, `product_substances` (+ `products.code/name`).

**Not used:** `research_updates` (table does not exist; not invented). Community tables do not exist; Community Updates stays 0.

## Review queue

| Tab | Postgres filter |
|---|---|
| Evidence Review | `evidence_assessments.review_status = review-required` (267 seeded) |
| Regulatory Review | `regulatory_records.review_status = review-required` |
| Claims | `claims.status in (review-required, draft)` |
| Review Queue | latest `review_actions` per substance; open if `request_review` |
| Product Mapping | paginated `product_substances` |

Page size 20. No full dump of sources/studies/claims into the browser.

## Review actions

Implemented UI actions (SQL enum subset): `approve`, `reject`, `request_review`, `publish`, `unpublish`.

`edit` is in SQL but has no UI (no statement editor).

Flow: **INSERT** `review_actions` (append-only) then **UPDATE** the entity workflow column. Claim approve does **not** change evidence A–F. Regulatory status stays separate from evidence.

`admin_user_id` is set from the signed-in admin when present; never invented.

## Claim / evidence / regulatory

Admin detail shows statement, type, substance, sources, studies, evidence assessment, regulatory fields. Missing sources are flagged. Community source types are filtered out of scientific source lists.

267 review-required evidence rows are visible to admin via 0028 `has_role(..., 'admin')`. They are **not** auto-approved.

## Source / study traceability

Claim detail loads `claim_sources` → `sources` / `studies`. Regulatory detail loads the linked `sources` row. Seeded claims all have sources (294/294).

## Security / RLS

Existing policies (no new roles):

- Admin SELECT all claims/evidence/regulatory (including review-required)
- Non-admin SELECT approved-only (0026/0028)
- Writes: `has_role(..., 'admin')`
- `review_actions`: SELECT + INSERT admin only; no UPDATE/DELETE policy

## Fallback

If dashboard fetch fails: error state + explicit button **Legacy-Fallback anzeigen (published.json)**. Banner states it is not the source of truth. No silent mix of JSON stats with Postgres queues.

## Performance

Counts use `select id { count: exact, head: true }`. Queues use `.range()`. Detail is a single-id fetch.

## Testing

`src/tests/researchAdminPostgresPhase8.test.ts`: workflow, append-only history, non-admin rejection, queue latest-action logic, source/study traceability, evidence 267 review-required (not auto-approved), regulatory review-required, SQL RLS, mapping without prices, postgres failure + labeled legacy fallback, public lexicon still files.

Gates (2026-08-28): **399** tests / 32 files; typecheck pass; lint 0 errors / 5 existing `react-refresh` warnings; production build pass.

## Known issues

- Logged-in browser QA of `/admin/research` against live `cartwise-prod` was not run in this phase (needs an admin session)
- `research_updates` still absent
- 267 evidence assessments remain review-required until an admin acts
- Public lexicon dual-read still default `legacy`

## STOP

No public lexicon switch, community, Batch 03, commit, or push.

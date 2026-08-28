# Phase 11 — Public lexicon Postgres cutover

**Date:** 2026-08-29  
**Verdict:** **LEXICON_CUTOVER_READY** (local commit, not pushed, not deployed).

Peptide routes stay behind `ProtectedRoute`. “Public lexicon” means non-admin logged-in users, not unauthenticated visitors.

## Old architecture

List and detail pages imported `catalog.ts` + `published.json` synchronously:

1. `PEPTIDE_SUBSTANCES_IDENTITY` (27 identity rows)
2. `applyPublishedProfile` overlay from `published.json`
3. `searchSubstances` / `matchesLexiconStatus` / `CATEGORY_LABELS` on that array
4. Detail: `getSubstanceBySlug` + `getPublishedProfile`

Admin Research already used Postgres (Phase 8). Dual-read compared files vs Postgres (Phase 7) but `lexiconDisplaySource()` always returned `legacy`. Default `VITE_RESEARCH_DB_MODE` was `legacy`.

## New architecture

```
VITE_RESEARCH_DB_MODE
  postgres (default) | dual
       │
       ▼
  fetchPublicLexicon (filtered SELECTs, no review-actions table)
       │
       ├─ success + 27 valid identities
       │     → mapPublicLexicon (approved + sourced only)
       │     → UI
       │
       └─ timeout | network | RLS | query | invalid | incomplete
             → exclusive full legacy catalog (catalog.ts + published.json)
             → console.warn [peptide-public-lexicon] exclusive-legacy-fallback

  legacy (emergency)
       → files only, no Postgres for the public UI
```

One request uses **either** Postgres **or** legacy. Missing Postgres fields are not filled from `published.json`.

Code: `src/lib/peptide/lexicon/*`, `src/hooks/usePublicLexicon.ts`, `PeptideLexicon.tsx`, `PeptideLexiconDetail.tsx`.

## Postgres read

Existing production tables only (no new migration):

| Table | Public use |
|---|---|
| `substances` | Identity (27 allowlisted slugs) |
| `substance_aliases` | Search: common_name + development_name |
| `substance_components` | Glow blend members |
| `claims` | `status = approved` at query time |
| `claim_sources` | Traceability |
| `evidence_assessments` | `review_status = approved` at query time |
| `sources` / `source_substances` | Citations |
| `studies` / `study_substances` | Trials; Hudson NCTs dropped in the mapper |
| `regulatory_records` | Current + `review_status = approved` in the mapper (RLS already restricts non-admins) |

Not selected on the public path: `review_actions`, `regulatory_history`, product prices, admin notes.

`product_substances` is unchanged and unused by this fetch. Lexicon variant codes still come from shop RPCs via `groupVariantsBySubstance` (codes/strengths only).

## Public visibility

Shown only if scientifically publishable:

- **Claims:** `status = approved` **and** at least one non-Hudson source. Orphans are hidden.
- **Evidence:** `review_status = approved` only. The 267 review-required assessments are not mapped. Identity can still exist at Evidence F.
- **Regulatory:** `review_status = approved` **and** `is_current`. Region (US, EU, …) is kept. No global Approved stamp.
- **Studies:** linked to a substance, not `NCT07487363` / `NCT07437560`.
- **reviewItems / review_actions:** never in the public profile (`reviewItems: []`).

Identity ≠ evidence. A profile is not auto-set to Evidence A or Approved because the row exists.

## RLS (live 0026–0028, unchanged)

- **claims:** non-admin `status = approved`; admin all. Public fetch still `.eq(status, approved)` so admins do not see draft/review-required claims **in the lexicon UI**.
- **evidence_assessments (0028):** non-admin approved assessments on approved claims; admin all. Public fetch still `.eq(review_status, approved)`.
- **regulatory_records:** non-admin current + approved; admin all. Mapper still requires approved + current.
- **review_actions:** admin SELECT only. Public client never queries that table.

## Fallback

Triggers: timeout (12s), network, RLS, query error, unexpected schema, missing identity slug, missing category after overlay.

Behaviour: log `exclusive-legacy-fallback`, return the **full** file catalog. No field-level merge.

Emergency rollback without a code rollback: `VITE_RESEARCH_DB_MODE=legacy`.

## Search / filters / categories

Search haystack (unchanged fields): name, displayName, aliases, developmentNames, slug, CAS.

Filters: existing category chips + `LEXICON_STATUS_FILTERS`.

Categories: `substances.category` (seeded from `catalog.ts`). If a Postgres value is empty/invalid, overlay **identity** category from `catalog.ts` by slug. No invented categories. If still missing → incomplete → full legacy fallback.

## Claims / evidence / regulatory / sources / studies

Detail sections still exist: Overview, Mechanism, Effects, Safety, Interactions, Reconstitution, Studies, Sources, Evidence, Regulatory. Empty sourced blocks render empty text rather than mixing in `published.json`.

Reconstitution is only the approved `:reconstitution` claim with sources. No new dose advice.

## Hudson

`NCT07487363` and `NCT07437560` are excluded from public studies and from claim source counts. Raw research cache is untouched.

## Identity

TB-500 ≠ Thymosin Beta-4; Melanotan II ≠ afamelanotide; IGF-1 LR3 ≠ mecasermin; Glow Blend = blend (not INN). Identity notes overlay from `catalog.ts` only when Postgres `identity_note` is empty (identity metadata, not science).

## Performance / caching

- Parallel table selects; claims/evidence filtered server-side; selective columns.
- Dataset is 27 substances; not the admin review queue.
- React Query `staleTime` **30 seconds**, `retry: 0`. After 30s the next mount/refetch may hit Postgres again. No localStorage research cache.
- `catalog.ts` + `published.json` remain in the client bundle **for exclusive fallback** (~348 kB catalog chunk).

## Security

Public mapped JSON is tested not to contain `review_actions` / `reviewActions` / `admin_user_id` / `service_role`. Shop prices and cart CTAs stay out of lexicon pages. Auth/login/session/roles unchanged.

## Shop isolation

No changes to `products`, prices, carts, orders. Mapping on detail pages is still SKU + strength only.

## Calculator

`PeptideCalculator.tsx` does not import the lexicon read path. Math only. Optional `vialMg` / `name` query params unchanged.

## Dual-read / admin

Admin `/admin/research` is unchanged (Postgres primary). Dual-read comparison still runs for admins when mode is `dual` or `postgres`. Successful compare reports `displaySource: postgres`. Compare fetch failure still reports exclusive legacy display for that compare run.

## Testing

`src/tests/researchPublicLexiconCutoverPhase11.test.ts` (16 tests): postgres read, exclusive fallback, review-required exclusion, identity-without-promotion, Hudson, search, filters, FOUNDAYO/US, reconstitution, RLS documentation, shop isolation.

Existing Phase 1–8 tests updated for default `postgres` and emergency `legacy`. None deleted.

Gates (2026-08-29, this working tree):

| Gate | Result |
|---|---|
| `npm test` | 426 passed / 34 files |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 pre-existing react-refresh warnings |
| `npm run build` | pass; `usePublicLexicon-*.js` chunk; catalog fallback chunk remains |

## Browser / production

**Not deployed.** `https://cartwise-zeta.vercel.app` still serves the Phase 10E files-based lexicon (`VITE_RESEARCH_DB_MODE` unset on that build → old default `legacy`).

Logged-in production route checks for the **new** read path were not run (would require a SPA deploy). Peptide routes need a session; this environment had no local Vite + login session.

## Rollback

Set `VITE_RESEARCH_DB_MODE=legacy` on Vercel and redeploy the SPA (after this code is deployed). No database restore. Do not apply the pre-research 0023 dump.

## Out of scope (honored)

No push. No deploy. No migration. No seed. No Batch 03. No community.

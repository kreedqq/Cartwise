# Phase 12A — Post-cutover limitation cleanup

**Date:** 2026-08-29  
**Verdict:** **POST_CUTOVER_READY_WITH_DOCUMENTED_FALLBACK_LIMITATION**  
**Git:** no commit, no push. **No deploy.** **No database change.**

Addressed the three Phase 12 audit limitations. Historical phase reports were not rewritten.

## Fallback test

Production database was not altered.

| Layer | What | Result |
|---|---|---|
| Unit | `resolvePublicLexicon` + `failingPublicSelectClient` for timeout, rls, network, query | Exclusive full legacy catalog (27 substances, Retatrutide mechanism present, `source: legacy`) |
| Unit | Incomplete Postgres identity | Exclusive legacy (includes missing slug) |
| Unit (new) | Invalid Postgres payload (substance row without slug/name) | Exclusive legacy, `fallback.kind: invalid` |
| Unit | `mode: legacy` even if Postgres would succeed | Files only, no mix |
| Production client intercept | Force `Failed to fetch` on research REST without touching Postgres | **Did not take effect** (page still used native `fetch`; live REST still succeeded). A second inject was not applied. |

A live production outage was **not** forced on the database.

Local peptide routes need a login (ProtectedRoute). Localhost does not share the production session, so a logged-in local Vite pass was not used.

## Fallback result

**Exclusive legacy fallback is covered by automated tests (427).** It is **not** proven by a live production network outage.

Expected contract (tests): one request is entirely Postgres **or** entirely legacy. No field mixing.

Production `/peptide`, `/peptide/lexikon`, `/peptide/lexikon/retatrutide` were re-checked on the **Postgres primary** path after cart QA (27 profiles, Reta → 1, Retatrutide PMID citations, no Slot crash). That is the happy path, not a simulated outage.

## Dual Read documentation fix

**Active UI (source, not yet on production SPA):**

- `src/components/admin/DualReadDebug.tsx` — no longer “Lexikon bleibt Legacy”. Now: Postgres Primary + exclusive file fallback; emergency `legacy` sentence when mode is `legacy`.
- `src/pages/admin/AdminResearch.tsx` — no longer “dateibasiert”. Now: public lexicon reads Postgres; `catalog.ts` + `published.json` are the exclusive fallback.

**Tests:** Phase 8 source assertions updated; old Dual Read sentence is forbidden.

**Production:** still serves `5e38cf1` Dual Read copy until a later SPA deploy (not this phase).

**Current project docs** updated below. Historical Phase 1–11 reports and completed TODO bullets that describe past file-based lexicon **left as history**.

## Cart QA

Production session **pepsidryage**, read-only.

| Check | Actual |
|---|---|
| Route | `/carts/48fec343-6d05-4d63-aaf4-05bba9e6bf8a` |
| Loads | yes |
| Item | AOD9604 |
| Code | 10AD |
| Quantity | 1 (displayed, not changed) |
| Line / unit price | 150,00 USD |
| Total | 150,00 USD · 128,81 € |
| Mutations | none (no qty edit, delete, add, checkout, order) |

Cart badge remained **1 Artikel**.

## Research counts

Unchanged vs Phase 12:

27 substances, 412 sources, 118 studies, 294 claims, 294 evidence, 41 regulatory, 19 review actions, 93 product mappings. Shop: 320 products, 0 orders.

## Shop

`/shop` four groups 165 / 51 / 79 / 3. Unchanged. No writes.

## Auth

Session kept. No logout.

## Tests / typecheck / lint / build

| Gate | Result |
|---|---|
| `npm test` | **427** passed (was 426; +1 invalid-payload fallback) |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 existing react-refresh warnings |
| `npm run build` | pass (`AdminResearch-BaedYgTQ.js` includes copy fix locally) |

## Code changed (not deployed)

- `src/components/admin/DualReadDebug.tsx`
- `src/pages/admin/AdminResearch.tsx`
- `src/tests/researchAdminPostgresPhase8.test.ts`
- `src/tests/researchPublicLexiconCutoverPhase11.test.ts`

## Known limitations

1. **Production exclusive fallback** still not demonstrated by a live SPA outage. Covered by unit tests only.
2. **Dual Read / Admin Research copy** is corrected in the working tree; **production still shows the old sentence** until the next SPA deploy.
3. Catalog fallback chunk (~348 kB) still ships (expected).

## STOP

No Batch 03. No community. No commit. No push. No deploy. No migration.

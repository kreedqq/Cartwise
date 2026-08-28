# Research Dual Read — Phase 7

**Date:** 2026-08-28  
**Live project:** `cartwise-prod` (schema 0001–0029; not switched)  
**Git:** no commit, no push.

## Verdict

**DUAL_READ_READY**

Seed-normalized legacy (`catalog.ts` + `published.json`) vs seed-shaped Postgres (0024–0029 import model) has **no critical differences**. Production display stays **legacy**. `VITE_RESEARCH_DB_MODE` default remains `legacy`.

Live browser comparison against `cartwise-prod` is **not** the default path (would need `dual` + admin session). Content parity is the same mapping used to seed production.

---

## Architecture

```
Lexikon UI (always files in Phase 7)
  catalog.ts + published.json
        │
        ├─ legacy normalizer ──► NormalizedResearchSnapshot
        │
dual / postgres (admin only, background)
        │
        └─ Postgres SELECT ──► PostgresResearchBundle
                 │
                 └─ postgres normalizer ──► NormalizedResearchSnapshot
                              │
                              └─ compare (MATCH / ORDER_ONLY / FORMAT_ONLY /
                                          MISSING / EXTRA / DIFFERENT / UNRESOLVED)
```

UI never waits on Postgres. On timeout / RLS / network / query error the lexicon still renders files.

| Mode | Fetch Postgres | Compare | Lexicon display |
|---|---|---|---|
| `legacy` (default, production) | no | no | files |
| `dual` | yes (admin) | yes | files |
| `postgres` | yes (admin) | yes | files (not switched) |

`lexiconUsesPostgresIdentity()` is still true only for `postgres` and is **unused** by lexicon pages.

---

## Legacy read

Unchanged pages:

- List: `PeptideLexicon.tsx` → `PEPTIDE_SUBSTANCES` + `searchSubstances` + status filters
- Detail: `PeptideLexiconDetail.tsx` → `getSubstanceBySlug` + `getPublishedProfile`
- Admin stats: `AdminResearch.tsx` still reads published JSON; dual-read panel is extra and admin-only

Search fields (spec): name, display name, alias, development name, slug, CAS. Category remains a filter, not a free-text haystack. Identity notes are not searched, so `TB-500` does not hit Thymosin Beta-4.

---

## Postgres read

`src/lib/peptide/persistence/dualRead/fetchPostgres.ts` SELECTs:

`substances`, `substance_aliases`, `substance_components`, `product_substances` (+ `products` join), `sources`, `source_substances`, `studies`, `study_substances`, `claims`, `claim_sources`, `evidence_assessments`, `regulatory_records`, `review_actions`.

No writes. Comparison is **admin-only** so `evidence_assessments` SELECT includes review-required rows (0028). Non-admins never see the debug panel.

---

## Normalizer

Both sides map into `NormalizedResearchSnapshot` (not raw SQL vs raw JSON).

- Identity: `catalog.ts` / `substances` (lifecycle status, aliases, blend components). Overlay CAS stays on published profiles.
- Sources/studies: unique keys (PMID → DOI → NCT → legacy id) plus attachments
- Claims: stable keys (`slug:slot`); summary paragraphs stay one claim
- Evidence: overlay A–F on `summary.humanEvidence`; other assessments review-required
- Regulatory: per-source records (not overlay scalars)
- Product maps: client `substanceSlugForProduct` vs `postgresMappingSlug` / `product_substances`

Empty `null` / `undefined` / `""` / `[]` compare equal.

---

## Comparison

| Family | Seed result |
|---|---|
| Identity 27 | MATCH (no critical) |
| Aliases 46 | MATCH |
| Sources 412 unique / 468 attachments | MATCH |
| Studies 118 unique / 123 attachments | MATCH |
| Claims 294 | MATCH |
| Evidence 27 overlay A–F + 267 review-required | MATCH |
| Regulatory 41 | MATCH + 2 UNRESOLVED |
| Review actions 19 | MATCH |
| Hudson NCT entities | MATCH (0) |
| Community | MATCH (0 / unavailable) |

ORDER_ONLY (study/source list order on detail) is non-critical.

---

## Search / filter parity

Queries: Reta, Retatrutide, LY3437943, Tirze, Tirzepatide, Semax, Selank, MOTS-c, TB-500, Thymosin Beta-4.

`TB-500` ↛ `thymosin-beta-4`. `Thymosin Beta-4` ↛ `tb-500`.

Category + status filters compared on normalized list items (overlay evidence + derived regulatory). No DIFFERENT.

---

## Claim / evidence / regulatory

Claims are not merged. Slot keys remain `summary.*`, `pharmacology:n`, `safetyItem:n`, `interaction:n`, `reconstitution`.

Evidence is not rewritten. Overlay remains the 27 humanEvidence assessments.

Known UNRESOLVED (not auto-corrected):

- `hcg:ema-ovitrelle`
- `semaglutide:fda-semaglutide-27f15fac`

Orforglipron FOUNDAYO NDA220934 US current. Retatrutide not stored as approved.

---

## Product mapping

Compared: client mapper vs `product_substances` / `postgresMappingSlug`.

| Codes | Postgres |
|---|---|
| RT5–RT40 | retatrutide |
| TR* | tirzepatide |
| SMO* | sermorelin |
| TA* | thymosin-alpha-1 |
| ML10 | melanotan-ii |
| BBG70 Glow | glow-blend |
| BT*, MT1, KL80, multi-INN, fragments, amides | unmapped (UNRESOLVED) |

Client-only fuzzy hits that are not in the unresolved list are UNRESOLVED, not auto-mapped.

---

## Fallback / performance / security

- Timeout default 12s; lexicon already rendered from files
- RLS / network / query errors → fallback, `DUAL_READ_NOT_READY` for that run, UI stays up
- Logs: `{ source, mode, verdict, counts, critical keys }` — no tokens, keys, emails
- Dual-read details: Admin Research only (`useDualRead` requires `isAdmin`)
- No community rows generated
- No PII in research logs

---

## Differences (seed vs files)

| Status | Meaning |
|---|---|
| MATCH | same after normalize |
| ORDER_ONLY | same set, different order |
| FORMAT_ONLY | empty-equivalent or overlay CAS not on `substances` |
| UNRESOLVED | documented (Ovitrelle, oral DailyMed title, unmapped SKUs) |
| MISSING / EXTRA / DIFFERENT | would be critical for identity/claim/source/study/regulatory/evidence/hudson/community |

Seed run: **criticalCount = 0**.

---

## Known issues

- Production env must stay `legacy` until an explicit lexicon switch
- Live dual fetch is admin + `dual`/`postgres` only; non-admin RLS would hide 267 evidence rows
- Overlay CAS is not a `substances.cas_number` (Phase 1). Search CAS uses the merged catalog object on the legacy side
- Three claim *narratives* still mention Hudson NCTs; entities remain 0
- Logged-in browser QA of shop/login was not run in this phase
- `postgres` mode does **not** drive the lexicon UI

---

## Readiness

**DUAL_READ_READY**

Conditions met: no critical diffs, no identity errors, no source/study/claim loss, no regulatory status errors beyond documented UNRESOLVED, no Hudson/community leakage, fallback works, tests pass.

Not done (blocked): lexicon switch, removing files, community, Batch 03, commit, push.

---

## Tests / gates

| Gate | Result |
|---|---|
| Tests | 384 passed / 31 files (`researchDualReadPhase7.test.ts` included) |
| Typecheck | pass |
| Lint | 0 errors, 5 existing `react-refresh` warnings |
| Build | pass; catalog chunk ~348 kB; Admin Research chunk includes dual-read (~62 kB) |

Lexicon list/detail chunks do not import the Postgres compare path. Production default remains `legacy` (no extra research fetch).

## Git

No commit. No push.

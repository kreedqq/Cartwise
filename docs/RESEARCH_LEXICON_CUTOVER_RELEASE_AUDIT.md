# Phase 11A — Lexicon cutover release audit

**Date:** 2026-08-29  
**Verdict:** **LEXICON_RELEASE_READY**

Local commit follows this audit (Phase 11B). No push. No deploy.

Production SPA remains the Phase 10E files-based build (`https://cartwise-zeta.vercel.app`). This audit covers the **local working tree** on `main` at `a6f660d` plus uncommitted Phase 11 files.

## Git

| | |
|---|---|
| Branch | `main` |
| HEAD | `a6f660d` `docs: document production ui fix deployment` |
| Remote | ahead of `origin/main` by **8** (unchanged; nothing pushed) |
| Working tree | dirty (Phase 11 uncommitted) |
| Base of this audit | `a6f660d` |

`git log --oneline -10` (HEAD first): `a6f660d`, `b079bbf`, `baaa335`, `a21e838`, `60131c0`, `837b155`, `d09a29a`, `0da9c90`, `aa26e9f`, `cb5b1a8`.

Tracked secrets: only `.env.example` (placeholder names/values). `.env`, `.env.local`, `.env.production` are not tracked.

## Changed files since `a6f660d`

### Modified (20)

| File | Class |
|---|---|
| `.env.example` | Documentation (env **names** only) |
| `docs/ARCHITECTURE.md` | Documentation |
| `docs/CHANGELOG.md` | Documentation |
| `docs/PROJECT_STATE.md` | Documentation |
| `docs/TODO.md` | Documentation |
| `src/lib/constants.ts` | Lexikon (`QUERY_KEYS.publicLexicon`) |
| `src/lib/peptide/persistence/researchDbMode.ts` | Research Read Layer / Mode |
| `src/lib/peptide/persistence/dualRead/compare.ts` | Research Read Layer (displaySource follows public mode) |
| `src/lib/peptide/persistence/dualRead/types.ts` | Research Read Layer |
| `src/lib/peptide/search.ts` | Search (`searchLexiconSubstances`) |
| `src/pages/peptide/PeptideLexicon.tsx` | Lexikon (list) |
| `src/pages/peptide/PeptideLexiconDetail.tsx` | Lexikon (detail) |
| `src/tests/button.test.tsx` | Tests (mock public lexicon for Slot) |
| `src/tests/researchAdminPostgresPhase8.test.ts` | Tests |
| `src/tests/researchDualReadPhase7.test.ts` | Tests |
| `src/tests/researchPersistencePhase1.test.ts` | Tests |
| `src/tests/researchPersistencePhase2.test.ts` | Tests |
| `src/tests/researchPersistencePhase3.test.ts` | Tests |
| `src/tests/researchPersistencePhase4.test.ts` | Tests |
| `src/tests/researchPersistencePhase5.test.ts` | Tests |

### Untracked

| File | Class |
|---|---|
| `docs/RESEARCH_PUBLIC_LEXICON_CUTOVER_PHASE_11.md` | Documentation |
| `src/hooks/usePublicLexicon.ts` | Research Read Layer |
| `src/lib/peptide/lexicon/*` (11 modules) | Research Read Layer / Fallback / Claims / Evidence / Regulatory / Sources / Studies / Identity |
| `src/tests/researchPublicLexiconCutoverPhase11.test.ts` | Tests |

`src/lib/peptide/lexicon/`: `categoryOverlay.ts`, `fetchPublicLexicon.ts`, `index.ts`, `legacyCatalog.ts`, `log.ts`, `mapPublicLexicon.ts`, `publicVisibility.ts`, `resolvePublicLexicon.ts`, `seedBundle.ts` (test helper from existing seeds, **no DB seed**), `types.ts`, `validatePublicLexicon.ts`.

### Unchanged (required)

Calculator (`PeptideCalculator.tsx`, `calculator.ts`), Admin Research page/service, shop/products/prices, carts, orders, checkout, auth (`AuthProvider`, login/register), `has_role` SQL, `supabase/migrations/` (still **0001–0029**), `catalog.ts`, `published.json`.

**No unexpected shop, auth, order, cart, price, admin-role, migration, or research-seed-file changes.**

## Read path

```
PeptideLexicon / PeptideLexiconDetail
  → usePublicLexicon
  → resolvePublicLexicon
       postgres|dual → fetchPublicLexicon → validate → mapPublicLexicon
       fail/incomplete → exclusive legacyPublicLexiconCatalog
       legacy mode → files only
```

List and detail both use the same hook. Fallback is the full file catalog, never field-level mix.

## Mode

| Mode | Public UI | Admin dual-read compare |
|---|---|---|
| `postgres` (default when unset) | Postgres + exclusive fallback | yes (admin) |
| `dual` | same as postgres | yes (admin) |
| `legacy` | files only | no |

Emergency: `VITE_RESEARCH_DB_MODE=legacy`. Names only in `.env.example`.

## Fallback

Verified in `resolvePublicLexicon` + Phase 11 tests:

| Condition | Result |
|---|---|
| Success + 27 valid identities | Postgres |
| Timeout / RLS / network / query | full legacy + `console.warn` exclusive-legacy-fallback |
| Invalid schema / missing slug / missing category | full legacy |
| Mapped count ≠ 27 | full legacy |
| `legacy` mode | files, no Postgres fetch |

No mix of Postgres and `published.json` fields on one request.

## Public visibility

- Claims: `status = approved` at query **and** ≥1 non-Hudson source in the mapper. Draft / review-required / rejected / orphan hidden.
- Evidence: `review_status = approved` at query and in the mapper. 267 review-required assessments are not public.
- Regulatory: `review_status = approved` **and** `is_current`. Region kept. Orforglipron FOUNDAYO stays US `approved-specific`, not global Approved. Retatrutide stays `clinical-development`.
- `reviewItems: []`. Public fetch never selects `review_actions`.
- Identity may exist at Evidence F / insufficient without promotion to A or Approved.

## Source traceability

`citedBlock` / `citeIdsForClaim` drop claims with zero remaining sources. Hudson NCT sources do not count.

## Hudson

`NCT07487363` and `NCT07437560` excluded from public studies and from claim source counts. Tests assert 0 public results. Raw cache untouched.

## Identity

TB-500 ≠ Thymosin Beta-4; Melanotan II ≠ afamelanotide; IGF-1 LR3 ≠ mecasermin; Glow = blend (`ghk-cu`, `tb-500`, `bpc-157`). Category overlay from `catalog.ts` by slug if Postgres category is empty; no invented categories.

## Search / filters / detail

Search haystack: name, displayName, aliases, developmentNames, slug, CAS. Queries Reta / LY3437943 / Tirze / Semax / Selank / MOTS-c / TB-500 / Thymosin Beta-4 covered by tests (no TB-500 → TB4).

Filters: existing category chips + `LEXICON_STATUS_FILTERS`. All 27 identity categories preserved on the seed map.

Detail headings unchanged: Scientific Evidence, Overview, Mechanism, Effects, Safety, Clinical Trials, Interactions, Reconstitution, Sources (plus regulatory badges/regions).

## Calculator

No diff vs `a6f660d`. Still math-only (`calculateReconstitution` / concentration / units / vial). Does not import `usePublicLexicon`.

## Admin

`AdminResearch.tsx` / `adminResearch.ts` unchanged. Postgres primary, paginated queues, append-only `review_actions`, mapping without prices.

**Expected side effect after deploy:** default mode `postgres` turns on admin dual-read comparison (`shouldCompareResearchReads`). That is the Phase 11 dual-read stay-available behaviour, not an Admin Research UI rewrite.

## Shop / auth

No file changes. Lexicon pages still have no cart CTA / no shop prices.

## RLS (live 0026–0028, no new migration)

- Non-admin claims: approved only.
- Non-admin evidence (0028): approved assessments on approved claims.
- Non-admin regulatory: current + approved.
- `review_actions`: admin SELECT only.
- Public path additionally `.eq` filters claims/evidence so an admin viewing `/peptide/lexikon` does not see review-required science there.

## API / security

Public mapper payload is tested not to contain `review_actions` / `reviewActions` / `admin_user_id` / `service_role`. No credentials in `.env.example` beyond placeholder anon names.

## Performance / bundle

- Parallel selective SELECTs; claims/evidence filtered server-side; 27-substance allowlist; 30s React Query cache; no `review_actions`.
- Sources/studies tables are still read in full with selective columns (412 / 118 scale). Not the admin review queue or 267 review-required evidence rows.
- Build: `usePublicLexicon-*.js` present; `catalog-*.js` ~348 kB gzip 58.6 kB kept for exclusive fallback (`published.json` expected).

## Tests / gates (this audit)

| Gate | Result |
|---|---|
| `npm test` | **426** passed / 34 files |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 5 pre-existing react-refresh warnings |
| `npm run build` | pass |

## Database

Live production remains **0029**. No new migration in this tree. `seedBundle.ts` only builds an in-memory fixture from existing TypeScript seeds.

## Known issues (non-blocking)

1. **Not deployed.** Production lexicon is still files (`VITE_RESEARCH_DB_MODE` unset on the 10E build → old default `legacy`).
2. Logged-in **browser QA of the new read path** was not run (needs SPA deploy + session).
3. Fallback keeps `published.json` in the client bundle.
4. Postgres-mapped `sourceQuality` is a type placeholder (3); UI does not display it as a scientific score.
5. Postgres-path `reviewStatus` on list/detail is `incomplete` (no freshness column on `substances`).
6. After deploy, admin dual-read comparison runs whenever mode is `postgres` or `dual`.

## Out of scope (honored)

Commit, push, deploy, migration, seed, Batch 03, community.

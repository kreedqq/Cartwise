# Research Persistence Phase 5 — Reconciliation & Migration Readiness

**Date:** 2026-08-28  
**Scope:** audit only. No lexicon switch, no community migration, no Batch 03, no schema/data changes, no git commit.  
**Baseline:** `60131c0` + uncommitted Phase 2–4.  
**Live project checked:** Supabase `cartwise-prod` (`cnjrjinvxycdkrmzcime`).

## Executive Summary

Phases 1–4 exist as SQL migrations and TypeScript seeds in Git. Legacy lexicon still reads `catalog.ts` + `published.json`.

**Content parity (seed vs files):** `READY_WITH_REVIEW`  
**Deployed database:** `NOT_READY` (applied through **0023** only; research tables are absent)  
**Lexicon switch:** `NOT_READY`

No published claims lack sources (294/294). Hudson NCTs are not study/source/claim rows in published JSON or seeds. Community sources are 0. Two known regulatory rows stay UNRESOLVED (not auto-corrected).

Recommended next step: apply `0024`–`0027` to the database when asked, then a **dual-read shadow** — not a lexicon cutover.

---

## Database Inventory

### Live `cartwise-prod`

Applied migrations: `0001`–`0023` (shop/auth). **No** `substances`, `sources`, `claims`, `regulatory_records`, or `review_actions`.

Shop snapshot used for mapping notes: **320** products.

### Intended Postgres (migrations `0024`–`0027` + seeds)

| Entity | Count | Origin |
|---|---|---|
| substances | 27 | catalog.ts |
| substance_aliases | 46 | catalog aliases + development names |
| substance_components | 3 | glow-blend → ghk-cu, tb-500, bpc-157 |
| product_substances | not in Git | `refresh_product_substance_prefix_mappings()` against live `products` |
| research_runs | 2 | historical_import Batch 01/02 |
| sources | 412 unique | 468 published nested rows |
| source_substances | 468 | |
| studies | 118 unique | 123 published nested rows |
| study_substances | 123 | |
| study_sources | 118 | |
| claims | 294 | cited blocks |
| claim_sources | 472 | |
| evidence_assessments | 294 | 27 overlay A–F; 267 review-required |
| regulatory_records | 41 | 40 current; 1 non-current |
| regulatory_history | 0 | no published transitions |
| review_actions | 19 | request_review from reviewItems |

---

## Legacy Inventory

| Entity | Location | Count |
|---|---|---|
| Identity substances | `catalog.ts` `PEPTIDE_SUBSTANCES_IDENTITY` | 27 |
| Aliases + development names | catalog | 46 |
| Published profiles | `published.json` | 27 (accessDate 2026-08-28) |
| Nested sources | published.json | 468 |
| Nested studies | published.json | 123 |
| Cited claim blocks | published.json | 294 |
| Overlay evidence A–F | profile `evidenceLevel` | 27 |
| Regulatory sources | `sourceType: regulatory` | 41 |
| Overlay regulatory scalars | profile `regulatoryStatus` / `regulatoryRegions` | 27 |
| reviewItems | published.json | 19 |
| Community reports | published.json | 0 (`available: false`) |

---

## Identity Parity (`catalog.ts` vs `substances`)

Compared to **identity catalog**, not the published overlay.

| Status | Count |
|---|---|
| MATCH | 27 |
| MISSING_POSTGRES | 0 |
| MISSING_LEGACY | 0 |
| DIFFERENT | 0 |
| UNRESOLVED | 0 |

Checked: slug, name, display name, molecule type, CAS (both null), chemical class (both null), lifecycle status (`blend` vs `active`).

**Known split (not a catalog mismatch):** published overlay may set CAS / chemical class / identityNote on the **merged lexicon object**. Phase 1 did not copy overlay CAS into `substances.cas_number`. Lexicon CAS today comes from `applyPublishedProfile`.

---

## Alias Parity

| Status | Count |
|---|---|
| MATCH | 46 |
| MISSING_POSTGRES | 0 |
| MISSING_LEGACY | 0 |

`common_name` ← catalog `aliases`; `development_name` ← `developmentNames`. Global unique alias index still separates TB-500 from Thymosin Beta-4. No afamelanotide/mecasermin aliases.

---

## Product Mapping Parity

Client: `substanceSlugForProduct` in `search.ts` (prefix, then glow name, then fuzzy name ≥ 4 chars).  
SQL: `refresh_product_substance_prefix_mappings()` copies **prefix + glow name only**. Fuzzy is intentionally absent.

Live `cartwise-prod` (2026-08-28), not applied to `product_substances` yet:

| SKU | Client | SQL prefix/glow | Note |
|---|---|---|---|
| RT5, RT10, RT20, RT30, RT40 (also RT15/50/60/100) | retatrutide | retatrutide | MATCH |
| BBG70 Glow | glow-blend (name) | glow-blend (name) | MATCH |
| KL80 Klow | glow-blend (name heuristic) | glow-blend (name heuristic) | UNRESOLVED: extra TB-500 in blend, no klow identity |
| BT5/BT10/BT20 TB-500 (Thymosin B4 Acetate) | tb-500 (fuzzy; first catalog hit) | none | DIFFERENT; shop label mixes TB-500 and TB4 |
| B10F TB-500 FRAG | tb-500 (fuzzy) | none | DIFFERENT |
| ML10 MT-2 | melanotan-ii (fuzzy) | none | DIFFERENT |
| MT1 MT-1 | melanotan-ii (prefix `MT2?` / `MT[0-9]`) | melanotan-ii | UNRESOLVED: SKU is Melanotan I |
| IG01 / IG1 IGF-1LR3 | likely unmapped (no `IGF` prefix; name spacing) | none | MATCH unmapped |
| SMO5/10/15 Sermorelin | sermorelin (fuzzy name) | none (`SM`+digit is semaglutide only) | DIFFERENT |
| TA5/TA10 Thymosin Alpha-1 | thymosin-alpha-1 (fuzzy) | none | DIFFERENT |
| BB10/BB20 BPC+TB blends | bpc-157 (fuzzy; bpc before tb-500) | none | DIFFERENT |

TB-500 ≠ Thymosin Beta-4 as **identities**. Shop names can still conflate them; mapper does not merge slugs.

---

## Source Parity

Nested published sources **468**. Unique Postgres **412** (PMID → DOI → NCT → published id). Attachments MATCH **468**. MISSING **0**.

DIFFERENT rows may exist when a shared identifier is merged and the **first title is kept**. Not a dropped source.

Community types: **0** imported (none in published.json).

---

## Study Parity

Nested **123**. Unique NCT **118**. Attachments MATCH **123**. MISSING **0**. Each unique NCT has a `study_sources` row.

---

## Claim Parity

| Status | Count |
|---|---|
| MATCH | 294 |
| MISSING_POSTGRES | 0 |
| MISSING_LEGACY | 0 |

**Claims with sources: 294. Claims without sources: 0.**

---

## Evidence Parity

| | Count |
|---|---|
| Assessments | 294 |
| Overlay A–F on `humanEvidence` | 27 |
| review-required | 267 |

Unchanged from Phase 3. Community cannot be an `evidence_type`. Substance overlay A–F is **not** copied onto every claim.

---

## Regulatory Parity

Per regulatory source:

| Status | Count |
|---|---|
| MATCH | 39 |
| UNRESOLVED | 2 |
| MISSING | 0 |

UNRESOLVED (not corrected in this phase):

1. `hcg:ema-ovitrelle` — related recombinant; `is_current = false`; not a urinary hCG EU approval  
2. `semaglutide:fda-semaglutide-27f15fac` — DailyMed title “OZEMPIC (ORAL SEMAGLUTIDE)” vs oral NDA213051; `review-required`

Safety: no global Approved; no `not_approved` from empty FDA/EMA search. Authorities in data: FDA, EMA only.

---

## Review Parity

19 `reviewItems` ↔ 19 `review_actions` (`request_review`, entity `substance`, `admin_user_id` null). MATCH 19.

Admin UI still lists JSON `reviewItems`. No persist of approve/reject from the page.

---

## Hudson Validation

| Location | NCT07487363 / NCT07437560 |
|---|---|
| Raw cache | **Present** (`tb-500.json`, `thymosin-beta-4.json`, `melanotan-ii.json`) — allowed |
| published.json studies[] | **Absent** |
| published.json sources.clinicalTrialId | **Absent** |
| Postgres studies/sources seeds | **Absent** |
| Claims / claim_sources | **Absent** |

Identifier **strings** appear in published identity notes / review item text as **exclusion documentation**. That is not a study row. Not auto-stripped.

---

## RLS Audit (SQL, not live — tables missing on prod)

All research tables: `ENABLE ROW LEVEL SECURITY`. Policies target `authenticated`, not `anon`. Writes require `has_role(..., 'admin')`. Table GRANTs to `authenticated` exist so RLS can run (same 0015 pattern). `anon` has no research GRANTs in 0024–0027.

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| substances, aliases, components, product_substances | authenticated | admin |
| sources | authenticated, `status = active` or admin | admin |
| studies, junctions, runs | authenticated | admin |
| claims | approved or admin | admin |
| claim_sources / evidence_assessments | admin **or parent claim approved** | admin |
| regulatory_records | current **and** approved, or admin | admin |
| regulatory_history | admin or parent current+approved | admin insert; no client update/delete |
| review_actions | admin | admin insert only |

**Review item (not changed):** 267 `review-required` assessments sit on **approved** claims, so authenticated SELECT can read them. Publication rule “only approved assessments go public” is **not** enforced at RLS yet.

`SECURITY DEFINER` helpers remain in `public` (`set_updated_at`, mapping refresh, regulatory history trigger).

No service_role secrets in `src/`.

---

## Orphan Audit (seeds)

| Check | Count |
|---|---|
| Source without substance | 0 |
| Study without substance | 0 |
| Study without source | 0 |
| Claim without source | 0 |
| Evidence without claim | 0 |
| Regulatory without source | 0 |

Review actions join `substances.slug`. Polymorphic `entity_id` has **no FK** (by design).

---

## Duplicate Audit

Sources unique on PMID/DOI/NCT (partial unique indexes). Studies unique NCT. Claims unique `stable_key` (same text in different slots kept separate). Regulatory unique `stable_key` / `(substance_id, source_id)`. No aggressive semantic merge.

---

## Data Completeness

| Entity | Legacy | Postgres seed | Match | Missing | Different / unresolved |
|--------|--------|---------------|-------|---------|------------------------|
| Substances | 27 | 27 | 27 | 0 | overlay CAS not in identity table |
| Aliases | 46 | 46 | 46 | 0 | — |
| Sources | 468 nested | 412 unique | 468 attachments | 0 | possible title-on-merge |
| Studies | 123 nested | 118 unique | 123 attachments | 0 | — |
| Claims | 294 | 294 | 294 | 0 | — |
| Evidence | 27 overlay + 267 unset | 294 rows | counts held | 0 | claim-level vs substance scalar |
| Regulatory | 41 sources + overlay scalars | 41 records | 39 | 0 | 2 UNRESOLVED |
| Review | 19 items | 19 actions | 19 | 0 | UI still JSON |

---

## Lexicon Field Readiness

| Lexikon field | Legacy | Postgres today | Status |
|---|---|---|---|
| Name / aliases | catalog | substances + aliases | Ready after apply |
| Description | overlay `summary.whatIsIt` | claims | Needs assembly query |
| Effects / mechanism / safety | cited blocks | claims | Needs slot/`stable_key` mapping |
| Pharmacology | published array (empty) | no PK rows | Empty both |
| Sources / studies | profile arrays | sources / studies | Ready after apply |
| Evidence badge A–F | overlay scalar | only on 27 humanEvidence assessments | **Gap**: no substance-level A–F column |
| Regulatory badge + regions | overlay scalar + regions[] | per-product records | **Gap**: must aggregate; do not show global Approved |
| Review items | profile.reviewItems | review_actions | Ready for admin; lexicon still JSON |
| CAS / class | overlay identity | substances null | **Gap** |
| Community | unavailable copy | no table | Keep unavailable |
| Shop variants | client mapper + shop RPC | product_substances after refresh | Fuzzy SKUs missing in SQL |

Postgres **cannot** drop-in replace the lexicon without a read assembler and dual-read checks.

---

## Admin Dependencies (unchanged)

| File | Uses | Persist approve/reject? |
|---|---|---|
| `src/pages/admin/AdminResearch.tsx` | `PEPTIDE_SUBSTANCES`, `listPublishedProfiles`, `reviewItems`, `researchReports`, `publishedSourceCount`, connector health stubs | **No** — read-only JSON |
| `src/research/engine.ts` | `RESEARCH_PIPELINE`, `canPublish` | In-memory tests only |
| `src/pages/peptide/PeptideLexiconDetail.tsx` | `profile.reviewItems` | Display only |

---

## `published.json` / `catalog.ts` / mapper dependencies

| File | Function / export | Dependency | Purpose |
|---|---|---|---|
| `src/lib/peptide/profiles/index.ts` | static import | published.json | SoT overlay |
| `src/lib/peptide/catalog.ts` | `applyPublishedProfile` at module init | profiles → published.json | Merge identity + overlay |
| `src/lib/peptide/search.ts` | `searchSubstances`, `substanceSlugForProduct` | PEPTIDE_SUBSTANCES | Search + SKU map |
| `src/lib/peptide/mapping.ts` | `toProductRef` | search mapper | Lexicon product refs |
| `src/pages/peptide/PeptideLexicon.tsx` | list/filter | catalog | List UI |
| `src/pages/peptide/PeptideLexiconDetail.tsx` | detail | catalog + getPublishedProfile | Detail UI |
| `src/pages/peptide/PeptideHub.tsx` | disclaimer only | catalog module | Still pulls catalog chunk |
| `src/pages/peptide/PeptideCalculator.tsx` | dose copy | catalog constants | Same module graph |
| `src/pages/admin/AdminResearch.tsx` | queue | catalog + profiles | Admin |
| Persistence seeds / tests | import profiles | published.json | Import + parity |
| Compile scripts | write published.json | Node | Not browser |

Shop pages do **not** import catalog. Mapper is used on lexicon detail via `useShopProducts`.

---

## Bundle

`published.json` is in the SPA because `catalog.ts` imports `profiles/index.ts`, which statically imports the JSON. Vite `catalog-*.js` chunk **~348 kB**. Peptide Hub/Calculator import catalog for disclaimers, so they share that graph. **No change in this phase.**

---

## Performance Readiness

A Postgres lexicon must **not** ship the full research DB to the browser.

Required later (not built):

- Search RPC: substances + aliases, category filter, pagination  
- Detail RPC: one slug + claims + sources + studies + current regulatory  
- Indexes already sketched (slug, pmid, nct, substance_id)  
- Dual-read comparison server-side or in a Node job, not 412 sources in the client  

---

## Security Readiness

- No service_role in client  
- Research writes gated by existing admin role  
- Public/anon: no research table grants in 0024–0027  
- Authenticated read of approved claims is the intended later public path  
- Gap: assessment `review-required` visibility (above)  
- Env names only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_RESEARCH_DB_MODE`

---

## Dual-Read Design (not implemented)

Extend `VITE_RESEARCH_DB_MODE`:

| Mode | Behavior |
|---|---|
| `legacy` (default) | catalog.ts + published.json only |
| `dual` | legacy response is canonical UI; Postgres fetched and compared; mismatches logged; UI stays legacy |
| `postgres` | Postgres assembler; on failure → legacy |

**Normalizer:** map Postgres rows to the current `PeptideSubstance` + `SubstanceProfile` shape (`stable_key` → summary slots, regulatory records → badge + regions, 27 humanEvidence A–F → overlay scalar).

**Allowed differences:** UUID vs compiled string ids; unique-source collapse (412 vs 468 nested); overlay CAS vs null identity CAS until copied; known UNRESOLVED regulatory.

**Failure:** timeout, RLS, missing tables → legacy; never blank lexicon.

`researchDbMode()` today only understands `legacy` | `postgres` and the lexicon **ignores** it.

---

## Rollback

Keep `catalog.ts` and `published.json`. Default env `legacy`. Postgres outage must not remove the file read path. No delete of compile cache.

---

## Test Plan (later switch)

Identity / alias / source / study / claim / evidence / regulatory / review parity (Phase 5 tests lock current counts). Product mapping parity including RT5–RT40 and glow. Hudson exclusion. RLS policy presence. Lexicon response deep-equal under `dual`. Search and detail page parity. Fallback to JSON.

Added now: `src/tests/researchPersistencePhase5.test.ts`. Existing tests kept.

---

## What is missing before a lexicon switch

1. Apply `0024`–`0027` (and seeds) to the live/staging database  
2. Dual-read assembler + `dual` mode  
3. Substance-level evidence/regulatory presentation rules  
4. Copy or join overlay CAS/class if the lexicon badge needs them  
5. Decide SQL vs client fuzzy mapping (SMO, TA, ML10, BT*, blends)  
6. Tighten evidence_assessments SELECT if review-required must stay admin-only  
7. Admin Research persist path (optional; not required to *read* lexicon)  
8. Pagination RPCs  
9. Resolve or explicitly accept the two regulatory UNRESOLVED rows  
10. Community remains out of scope  

---

## Migration Readiness

| Layer | Status |
|---|---|
| Seed vs published/catalog | **READY_WITH_REVIEW** (2 regulatory UNRESOLVED; mapping fuzzy gap; overlay CAS) |
| Live DB | **NOT_READY** (0023 only) |
| Lexicon switch | **NOT_READY** |
| Community | Not started (by design) |
| Batch 03 | Blocked |

---

## Known Issues

- Research schema not applied on `cartwise-prod`  
- Admin queue is JSON  
- Overlay vs identity CAS/class  
- Evidence RLS vs review-required assessments  
- Shop labels TB-500/TB4 and MT-1 vs melanotan-ii prefix  
- Hudson NCT strings in exclusion notes  
- Bundle still includes published.json  

## Recommended Next Step

When asked: apply migrations `0024`–`0027` to a database, verify seed counts, then implement **dual-read** (`legacy` UI + Postgres compare). Do **not** switch the lexicon, start Batch 03, or migrate community.

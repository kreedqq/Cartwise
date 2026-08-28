# Research Persistence & Database Architecture

**Status:** Phases 1–4 are implemented in Git (see `docs/RESEARCH_PERSISTENCE_PHASE_*.md`). Phase 5 audit: `docs/RESEARCH_PERSISTENCE_PHASE_5_READINESS.md`. This file remains the original target analysis; later phase tables now exist as migrations. Lexicon switch is still not started.  
**Date:** 2026-08-28  
**Code baseline before Phase 1:** `837b155` (`chore: backup research batch 02`)

This document describes **how research actually works** and the **target** Postgres design. Phase 1 tables are documented in `docs/RESEARCH_PERSISTENCE_PHASE_1.md`. Nothing in later phases was implemented.

---

## 1. Executive Summary

Peptix already has a durable Postgres database for **shop** (products, carts, orders, roles, audit). Peptide **research is not in that database**.

Scientific content lives in:

1. `src/lib/peptide/catalog.ts` — identity skeleton (27 slugs)
2. `src/lib/peptide/profiles/published.json` — curated, cited overlays (27 profiles); this is what the lexicon shows
3. `src/research/cache/fetched/*.json` — compact official-API snapshots used only by Node compile scripts
4. `scripts/*.mjs` — fetch + compile (not called from the browser)

There is **no ORM**. Shop access is `supabase-js` + SQL migrations `0001`–`0023` and RPCs. Research types (`PeptideSource`, `PeptideStudy`, `CommunityReport`, `ResearchUpdate`) exist in TypeScript but have **no tables** and are **not written** at runtime.

The lexicon loads **the entire published catalog in the frontend bundle** (~348 kB gzip-relevant catalog chunk). Admin Research is **read-only**: it cannot approve/reject, compare versions, or persist a decision.

**Recommended target:** Postgres as source of truth for approved research; file cache remains a connector cache; `published.json` becomes an optional build/read replica; the lexicon never reads raw connector JSON.

**Migration complexity:** high (claims are nested text, not rows). **Do not start** until explicitly commissioned. Do not start Batch 03 as part of persistence work.

---

## 2. Current Architecture

```
Browser (Vite SPA)
  ├─ Shop / carts / orders  → Supabase Postgres (RLS + RPCs)
  ├─ Auth                   → GoTrue (Discord OAuth, email)
  ├─ Lexikon / Rechner      → TypeScript catalog + published.json (bundled)
  └─ Admin /research        → same JSON (read-only) + stub connectors (always unavailable)

Node (developer machine / CI, not Edge)
  scripts/fetch-research-sources.mjs
  scripts/fetch-regulatory-labels.mjs
  scripts/compile-research-profiles.mjs
       ↓ writes
  src/research/cache/fetched/
       ↓ curated compile
  src/lib/peptide/profiles/published.json
```

**Database:** PostgreSQL via Supabase.  
**ORM:** none.  
**Client library:** `@supabase/supabase-js`.  
**Types:** hand-mirrored in `src/types/database.ts`.  
**Hosting:** SPA (`vercel.json`); peptide routes behind `ProtectedRoute`; admin research behind `AdminRoute`.

### Shop tables that exist (not research)

`profiles`, `user_roles`, `products`, `product_price_history`, `carts`, `cart_items`, `cart_summaries` (view), `orders`, `order_items`, `order_status_history`, `order_admin_notes`, `order_templates`, `order_template_items`, `customer_roles`, `user_customer_roles`, `product_favorites`, `exchange_rates`, `pdf_imports`, `pdf_import_rows`, `audit_logs`. Storage bucket for PDF imports.

**Research-named SQL tables:** none.

---

## 3. Current Research Storage

| Data | Location | Format | Owner | Read path | Write path | Persistence | Versioning | Update |
|---|---|---|---|---|---|---|---|---|
| Identity catalog | `src/lib/peptide/catalog.ts` | TS constants | Git | `getSubstanceBySlug`, lexicon search | Edit file + commit | Git | Git history only | Manual |
| Published science | `src/lib/peptide/profiles/published.json` | JSON object `{ accessDate, profiles }` | Git | Vite import in `profiles/index.ts` | `npm run research:compile` | Git | Full-file overwrite per compile | Manual compile |
| Raw API cache | `src/research/cache/fetched/{slug}.json` | JSON | Git | Compile script only | `npm run research:fetch` | Git | Overwrite per fetch | Manual fetch |
| FDA labels | `src/research/cache/fetched/{slug}.fda-label.json` | JSON | Git | Compile script | `npm run research:labels` | Git | Overwrite | Manual |
| EMA HTTP checks | `src/research/cache/fetched/ema-check.json` | JSON array | Git | Compile (hardcoded EMA map, not this file directly for all slugs) | labels script | Git | Overwrite | Manual |
| Curated claims | `scripts/compile-research-profiles.mjs` + `scripts/research-batch-02-curated.mjs` | JS objects | Git | Compile | Edit scripts | Git | Git | Manual |
| Product↔substance map | `src/lib/peptide/search.ts` prefixes + name heuristics | TS | Git | `substanceSlugForProduct` at runtime from shop rows | Edit file | Git | Git | Manual |
| Shop products | Postgres `products` | SQL | Supabase | RPCs `list_shop_products` | Admin import / product UI | DB | `product_price_history` for prices; `audit_logs` for product rows | Live |
| Browser connector results | none | stubs return empty | — | Admin health table | none | none | none | always `unavailable` |
| LocalStorage | theme only (`useTheme`) | string | browser | theme | theme | session | none | not research |
| Server memory / Edge | not used for research | — | — | — | — | — | — | — |

`src/research/cache.ts` defines `ResearchCacheEntry` and `isFresh()`. **Nothing in the app calls it.** Freshness is the `accessDate` / `lastResearchScanAt` string on compiled profiles.

---

## 4. Current Source of Truth

| Class | Current SoT | Problem |
|---|---|---|
| Substance identity (name, aliases, blend components) | `catalog.ts` | Overlay in `published.json` can replace CAS, class, identityNote, moleculeType |
| Scientific description / evidence / regulatory | `published.json` after compile | Dual write: curated JS + compile filters; identity file still F until overlay |
| Product SKU, price, availability | Postgres `products` | Correct; must stay out of substance |
| Product → substance | Client mapping, not DB | Unmapped SKUs silently have no lexicon link; no FK |
| Source | Nested arrays in `published.json` | IDs are compile-generated strings (`pmid-…`, `nct-…`, `fda-…`), not UUIDs; not globally unique across substances except by convention |
| Study | Nested `studies[]` in profile | Deduped per substance by NCT at compile; same NCT could theoretically appear on two slugs |
| Claim | `CitedText` / safetyItems / interactions — **not an entity** | No claim id, no version, no old/new |
| Evidence level A–F | Profile scalar | One number for the whole substance |
| Regulatory | Profile scalar + `regulatoryRegions[]` | No authority row, no indication row, no history |
| Community | Hardcoded `{ available: false }` | Type `CommunityReport` unused |
| Research update / draft | In-memory helper `createResearchDraft` | Tests only; Admin cannot persist |
| Rejected sources | Mostly implicit (not copied into published.json) | Hudson NCTs remain in raw cache; no `rejected_sources` table |

**Split brain:** lexicon list items come from `PEPTIDE_SUBSTANCES` (identity + overlay). Detail scientific blocks come from `getPublishedProfile`. If compile omits a slug, identity remains F/insufficient. If overlay and catalog identityNote disagree, overlay wins on the merged substance.

---

## 5. Current Data Flow

```
External API (CT.gov / PubMed / openFDA / PubChem / EMA HTTP)
        ↓  Node fetch scripts (no retry policy, sleep 200–500 ms)
Raw JSON files under src/research/cache/fetched/
        ↓  keepStudy / keepArticle / Hudson+mock filters
        ↓  PINNED_NCTS / PINNED_PMIDS / CURATED JS summaries
Compile → published.json (publicationStatus always "published")
        ↓  Vite bundles JSON into catalog chunk
applyPublishedProfile(catalog identity)
        ↓
Lexikon UI (cited blocks)  |  Admin Research (stats + reviewItems list)
```

| Pipeline step (`RESEARCH_PIPELINE`) | Exists in code? |
|---|---|
| Identity Search | Manual in `catalog.ts` |
| Regulatory Search | Node openFDA + EMA HTTP; curated status |
| Clinical Trial Search | Node CT.gov v2 `pageSize=20` |
| PubMed Search | Node E-utilities `retmax=15` |
| Scientific Literature | Same PubMed list + pinned extras |
| Pharmacology / Safety / Interaction | Curated text from labels/papers, not a separate fetch |
| Community Search | Stub; Reddit always unavailable |
| Deduplication | Compile: NCT/PMID/setId sets |
| Source quality | Heuristic rank 1–5 at compile |
| Evidence classification | Hardcoded per slug in CURATED |
| Conflict detection | Optional `conflicts[]` on profile |
| Summary generation | Curated German `cited()` strings |
| Admin review | Display `reviewItems` only |
| Publication | Git commit of `published.json` |

**Missing vs the requested flow:** normalize/validate on live connectors (stubs return `null` / unavailable); no Research Entity table; no claim row; no stored review decision; lexicon never sees raw cache (good).

---

## 6. Current Data Models

### SUBSTANCE

- **Storage:** TS + JSON overlay.  
- **Ideal:** `substances` + `substance_aliases`.  
- **Migration:** yes.  
- **Relations:** blend via `blendComponentSlugs[]` (no FK). Identity specials: TB-500 ≠ thymosin-beta-4; melanotan-ii ≠ afamelanotide; igf-1-lr3 ≠ mecasermin; glow-blend `moleculeType: blend`.

### SOURCE

- **Storage:** `ProfileSource[]` inside each profile. Parallel unused type `PeptideSource` (draft/approved/rejected).  
- **Ideal:** `sources` + `substance_sources` or `claim_sources`.  
- **Search-count rows** (`ct-count-slug`, `pm-count-slug`) are classified `scientific`, not trials.

### STUDY

- **Storage:** `ProfileStudy[]`. Fields: nct, title, phase, status, sponsor, enrollment, dates, hasResults, url. **No** intervention, comparator, outcomes in published rows (only in raw CT.gov compact if present — compact does **not** store intervention/outcomes).  
- **Ideal:** `studies` unique on `nct_id`; `study_substances`; optional `study_publications` for PMID.

### CLAIM

- **Does not exist as an entity.** Closest: `CitedText { text, sourceIds[] }` on summary keys, safety items, interactions, reconstitution, reviewItems.  
- **Ideal:** `claims` + `claim_sources` + `claim_versions`.

### REGULATORY

- Scalars: `regulatoryStatus`, `regulatoryRegions`. No authority, indication, effective date as columns (those appear inside cited German text / FDA source titles). Enum in TS: `approved`, `approved-specific`, `clinical-development`, `investigational`, `not-approved`, `insufficient`, `unknown`. Compile avoids `not-approved` from empty FDA search.

### EVIDENCE

- Substance-level `evidenceLevel` A–F + `confidenceLevel`. Human vs preclinical is **section text**, not a typed evidence row. Community cannot raise evidence: `communityCannotRaiseEvidence` **returns the current level unchanged** (convention + tests, not a DB trigger).

### COMMUNITY_REPORT

- Type only. Published community is `{ available: false, message }`.

### RESEARCH_UPDATE

- Type + `createResearchDraft` / `canPublish` (scientific updates need `reviewed && status === "approved"`). **No persistence.** Admin stats “Regulatory Updates” / “Community Updates” are hardcoded `0`.

---

## 7. Current Problems

1. **Research is a Git artifact**, not a database. Two editors, no row-level RLS, no admin approve path that writes.
2. **Entire science graph is in the SPA bundle.** Catalog chunk ~348 kB; will grow with Batch 03+ or more sources.
3. **Claims are not addressable.** Cannot diff claim v1 vs v2; cannot attach one PMID to one claim without editing a paragraph.
4. **Raw cache is incomplete.** CT.gov stores at most 20 studies; PubMed at most 15 article records; `totalCount`/`count` can be 1000+. Recompile cannot recover unpublished hits that were never cached.
5. **`isFresh` unused.** Staleness is a date string, not enforced.
6. **Rejected sources have no first-class store.** Exclusion lives in `keepStudy` / comments / reviewItems.
7. **Product mapping is heuristic**, not `product_substances`.
8. **Admin review cannot act.** No before/after, no reject, no actor.
9. **Two source types** (`PeptideSource` vs `ProfileSource`) invite later mapping bugs.
10. **Compile is all-or-nothing** for the BATCH list; a bad curated citation (`missing-pmid-…`) is only a console warning.
11. **Connector interface in the browser is a façade.** Real I/O is Node scripts with different shapes.
12. **No research_run log.** Cannot answer “what did fetch batch02 query for selank on 2026-08-28?” except by reading the cache file.

---

## 8. Risks (current + future migration)

| Risk | Severity | Mitigation |
|---|---|---|
| Duplicate sources (same PMID on two slugs) | Medium | Unique `(identifier_type, identifier)` globally; junction to substances |
| Duplicate studies | Medium | Unique `nct_id` |
| Wrong substance mapping (selank substring, hCG CID 1108) | High | Keep compile filters as import validators; store `rejected` rows |
| Missing sources after import | High | Diff published.json source ids vs inserted rows before switch |
| Missing claims (paragraphs not split) | High | Import each `CitedText` as one claim keyed by `slot` (whatIsIt, safety, …) first; split later |
| Invalid IDs | Medium | Check `everyStatementCited` after import |
| Stale cache treated as truth | High | Cache never public; `retrieved_at` + run_id |
| Orphan sources | Medium | FK + restrict delete of published sources |
| Blends treated as INN | High | `molecule_type = blend` + `substance_components` table; no studies on blend |
| Alias collision | Medium | Unique alias per substance; search uses aliases table |
| Regulatory conflicts | Medium | `regulatory_records` allow multiple regions; `conflicts` table |
| Community raising evidence | High | Separate schema/table; trigger or RPC forbids using community source_ids on scientific claims |
| Shop regression | Critical | No ALTER on `products` prices/RLS; mapping is new table only |
| Bundle still huge during dual-read | Medium | Feature flag: detail page fetches one substance |

---

## 9. Proposed Target Architecture

```
Official APIs
    → research_runs + research_run_sources (raw payload or blob ref)
    → normalize/validate (server only, service role or Edge)
    → sources / studies (status: raw | rejected | candidate | approved)
    → claims (draft) + claim_sources
    → review_actions (admin)
    → publication_status = approved
    → lexicon read API (RLS: authenticated users read approved only)
    → optional published.json export for offline/build
```

**Invariants**

- Shop `products` unchanged as commercial SoT.
- Lexicon never selects `status = raw` or connector cache.
- Community tables cannot be referenced from scientific `claim_sources`.
- TB-500 / TB4 / MT-II / IGF-LR3 / glow-blend remain separate rows.

**Layers**

| Layer | Role |
|---|---|
| Cache | `research_run_sources` / files during transition |
| Working | draft claims, candidate studies |
| Published | `approved` rows only |
| Read replica | optional JSON export |

---

## 10. Proposed Database Schema

Use a dedicated schema `research` **or** `public` with RLS (project already uses `public` + `has_role`). Recommendation: **`public` with `research_` prefix** to match existing migrations, unless a private schema is preferred for service-role-only writes. Either way: **RLS on**, no service_role in `src/`.

Suggested enums (Postgres):

- `research_publication_status`: `draft`, `in_review`, `approved`, `rejected`, `superseded`
- `research_source_kind`: match TS `SOURCE_TYPES`
- `research_evidence_level`: `A`–`F`
- `research_regulatory_status`: match TS `REGULATORY_STATUSES`
- `research_connector_kind`: `scientific`, `community`

### `substances`

| | |
|---|---|
| Purpose | Scientific identity (not SKU) |
| PK | `id uuid` |
| Unique | `slug text` |
| Columns | `name`, `display_name`, `cas_number`, `category`, `molecule_type`, `chemical_class`, `identity_note`, `blend` bool, `evidence_level`, `confidence_level`, `regulatory_status`, `review_status`, `last_reviewed_at`, `last_research_scan_at`, `last_community_scan_at`, timestamps |
| FK | none to products |
| Delete | restrict if claims/sources exist |

### `substance_aliases`

PK `id`; FK `substance_id` ON DELETE CASCADE; `alias text`; `kind` (`alias` \| `development_name` \| `abbreviation`); **UNIQUE (substance_id, lower(alias))**.

### `substance_components`

For blends: FK `blend_id`, `component_id` both → `substances`; UNIQUE pair. Glow-blend → ghk-cu, tb-500, bpc-157.

### `product_substances`

| | |
|---|---|
| Purpose | Shop SKU → substance without copying price |
| PK | `id uuid` |
| Unique | `product_id` (or `(product_id, substance_id)` if multi) |
| FK | `product_id` → `products(id)` ON DELETE CASCADE; `substance_id` → `substances` ON DELETE RESTRICT |
| Columns | `mapping_method` (`prefix` \| `name` \| `manual`), `is_blend` |
| Indexes | `substance_id` |

**Do not** add `price_usd` here.

### `research_runs`

PK `id`; `started_at`, `completed_at`, `status` (`running` \| `completed` \| `failed`); `batch_label`; `operator_note`; `error`; counts (`sources_found`, `accepted`, `rejected`).

### `research_run_sources`

PK `id`; FK `run_id`; `connector_id`; `query`; `http_status`; `payload jsonb` (or storage path); `retrieved_at`. This **is** the durable raw cache.

### `sources`

| | |
|---|---|
| Purpose | Canonical bibliographic/regulatory record |
| Unique | `(identifier_type, identifier)` where identifier is PMID, NCT, DOI, DailyMed setId, or URL hash |
| Columns | `title`, `url`, `publisher`, `publication_date`, `access_date`, `doi`, `pmid`, `nct_id`, `source_type`, `source_quality`, `status`, `rejection_reason`, `run_id` |
| Delete | restrict if attached to approved claims |

### `studies`

Unique `nct_id`; columns as `ProfileStudy` plus nullable `intervention`, `comparator`, `primary_outcome` (fill when available). FK optional `primary_source_id`. Many-to-many `study_substances`.

### `claims`

PK `id`; FK `substance_id`; `slot` (`what_is_it`, `mechanism`, `safety`, …); `body`; `domain` (`human` \| `animal` \| `in_vitro` \| `theoretical` \| null); `status`; `version`; `supersedes_claim_id`.

### `claim_sources`

PK; UNIQUE (`claim_id`, `source_id`); FK both restrict.

### `evidence_assessments`

Optional 1:1 or historized: FK `substance_id`; `evidence_level`; `confidence`; `rationale_claim_id`; `as_of`.

### `regulatory_records`

FK `substance_id`; `authority` (`FDA` \| `EMA` \| …); `region`; `status`; `indication`; `application_number`; `source_id`; `effective_date`; `checked_at`; `current` bool.

### `regulatory_history`

Append-only copy on change of `regulatory_records` (trigger), or only use history table + “current” view.

### `community_reports`

FK `substance_id`; `platform`; `classification`; `status`; **check** `source_type in community types`. No FK from `claims` where `scientific = true`.

### `research_updates`

Matches `ResearchUpdate`: substance, type, importance, status, summary, `detected_at`, `run_id`.

### `review_actions`

`actor_id` → `auth.users`; `entity_type`; `entity_id`; `decision` (`approve` \| `reject` \| `edit`); `before jsonb`; `after jsonb`; `reason`; `created_at`. Prefer also writing `audit_logs` with new `entity_type` values so shop audit stays one table **or** keep research review separate to avoid mixing SKU and science. Recommendation: **`review_actions` for research** + optional `log_audit` for high-level events.

### Indexes (minimum)

- `substances(slug)`, `substances(category)`, `substances(review_status)`
- `sources(pmid)`, `sources(nct_id)`, `sources(doi)` (unique where not null)
- `claims(substance_id, status)`, `claim_sources(source_id)`
- `regulatory_records(substance_id, region)` where `current`
- `product_substances(substance_id)`, `product_substances(product_id)`
- `research_runs(started_at desc)`

### Delete behavior

Never cascade-delete approved sources from a substance. Soft-status `superseded`. Raw run payloads can be purged after N days once compiled rows exist (policy, later).

---

## 11. Relationships

```
products 1──n product_substances n──1 substances
substances 1──n substance_aliases
substances 1──n substance_components (self)
substances 1──n claims 1──n claim_sources n──1 sources
substances 1──n studies (via study_substances)
substances 1──n regulatory_records 1──n regulatory_history
substances 1──n community_reports     (no path to evidence_level)
substances 1──n research_updates
research_runs 1──n research_run_sources
review_actions n──1 auth.users
```

Community ─x─► `evidence_assessments` (forbidden).

---

## 12. Index Strategy

Read path for lexicon detail: `substances.slug` → claims (approved) → claim_sources → sources. One round-trip via view or RPC `get_lexicon_substance(slug)`.

List/search: Postgres `pg_trgm` on name/aliases **or** keep client search until row counts grow; 27 rows do not need trigram yet. Plan trigram before hundreds of substances.

Admin queue: index `review_status` + `research_updates.status`.

Do **not** GIN-index entire raw JSON payloads unless querying them; store run payloads for audit, query structured tables.

---

## 13. Versioning Strategy

**Claims:** insert v2 row, set v1 `status = superseded`, `supersedes_claim_id` on v2. Never UPDATE body of an approved claim in place.

**Sources:** `discovered` → `validated` → `updated` (new row or `content_hash` change) → `superseded`. Keep URL+identifier; if DailyMed setId gets a new effectiveTime, new source row linked from new claim version.

**Substance scalars** (evidence, regulatory): write `evidence_assessments` / `regulatory_history` rather than silent UPDATE.

Store: `old_value`, `new_value`, `source_id`, `reason`, `created_at`, `review_action_id`.

---

## 14. Research Run Strategy

Every fetch (even local Node, later Edge) creates a `research_runs` row:

- `run_id`, `started_at`, `completed_at`, `connector` or `connectors[]`, `query`, counts, `errors jsonb`, `status`

Link accepted/rejected sources via `research_run_sources` and `sources.run_id`. Hudson NCT07487363 stays in run payload with `rejected` + reason `fictional_or_hudson_cluster`.

---

## 15. Source Strategy

- Canonicalize PMID, NCT, DOI, DailyMed `setId`, EMA EPAR URL.
- Rejected sources **are stored** (status rejected) so they are not re-promoted blindly.
- Search-count URLs remain sources of type `scientific` with quality 3, not `clinical_trial`.
- Quality 1–5 stays on the source, not on the claim.

---

## 16. Claim Strategy

Phase-1 import: **one claim per existing cited slot** (8 summary fields + each safety/interaction row + reconstitution). That preserves traceability without NLP splitting.

Phase-2 (optional): finer atomic claims.

Each published sentence already has `sourceIds`; map those strings to `sources.id` during import.

---

## 17. Evidence Strategy

Keep substance-level A–F as a derived or explicitly reviewed `evidence_assessments` row. Human vs preclinical stay claim `domain`. Community reports never appear in `claim_sources` for scientific slots. Enforce with CHECK: scientific claims may only reference `source_type` not in `blog|reddit|forum|community`.

---

## 18. Regulatory Strategy

One **current** record per `(substance, authority, region, indication)` plus history. Empty FDA search → `insufficient` or `investigational` as curated, **never** auto-`not-approved`. Regions stay on the record, not a global approved flag.

Example history: investigational → approved-specific (US) when a DailyMed source is approved.

---

## 19. Community Strategy

Table exists but **empty** until an official Reddit (or other) API exists. Classification enum unchanged. `last_community_scan_at` nullable. Connector stubs remain unavailable. Scraping remains forbidden.

---

## 20. Admin Review Strategy

**Today:** Admin Research shows connector health (all unavailable), per-slug FDA/EMA/trial/pubmed counts from `researchReport`, and `reviewItems` text. No approve control. No diff.

**Target:** queue of `research_updates` + draft claims; diff `before_data` / `after_data`; buttons write `review_actions` and set status. Reuse `has_role(..., 'admin')`. Do not put review in the shop product UI.

Existing `canPublish` logic is the right gate: scientific material requires explicit approve.

---

## 21. Publishing Strategy

**Today:**

```
curated JS + cache → compile → published.json → Vite bundle → lexicon
```

**Target:**

```
DB approved rows → RPC get_lexicon_substance
optional: CI job exports published.json for backup/offline
feature flag RESEARCH_READ=json|postgres during dual-read
```

Lexicon must ignore raw `research_run_sources`.

---

## 22. Migration Strategy

1. **Schema** — enums, tables, RLS (admin write via RPC; authenticated read approved).  
2. **Tables / relations / indexes / constraints** — as §10.  
3. **Data import** — script reads `published.json` + `catalog.ts` + mapping function; does not call live APIs.  
4. **Validation** — `everyStatementCited` equivalent SQL; count 27 substances, 125 Batch-02 sources, Hudson NCT absent from approved studies.  
5. **Dual read** — flag; compare JSON vs SQL for each slug.  
6. **Switch** — lexicon detail from RPC; list can stay JSON until pagination needed.  
7. **Legacy removal** — stop bundling full JSON only after switch is proven; **keep files in Git as rollback**.

Do **not** import raw cache into public tables.

---

## 23. Dual Read Strategy

```
getSubstanceView(slug):
  if flag postgres: RPC
  else: getPublishedProfile(slug)
CI: for all slugs, evidenceLevel, regulatoryStatus, source count, study NCT sets must match
```

Mismatch → do not switch; keep JSON.

---

## 24. Rollback Strategy

- Git still contains `published.json` and `catalog.ts`.
- Feature flag back to `json`.
- Do not DROP tables on rollback; leave unused.
- If a bad approve lands: `review_actions` reject + claims.status = superseded; lexicon reads approved only.
- Shop unaffected (no migration on cart/order RPCs).

---

## 25. Testing Strategy

| Suite | What |
|---|---|
| Identity | TB-500 ≠ TB4; MT-II ≠ afamelanotide; IGF-LR3 ≠ mecasermin; glow-blend components |
| Source | PMID/NCT unique; CID 1108 not on hcg; search-count not typed as trial |
| Study | Hudson NCT07437560 / NCT07487363 not approved |
| Claim | every approved claim has ≥1 scientific source |
| Regulatory | no `not-approved` from 404 alone |
| Community | insert community source cannot attach to scientific claim (constraint test) |
| Mapping | RT10 → retatrutide; GLOW → glow-blend; no price in ref |
| Migration | row counts vs published.json snapshot |
| Read-after-write | approve claim → lexicon RPC returns it |
| Rollback | flag json still serves 27 profiles |
| Regression | existing 283 tests still pass; shop RLS tests untouched |

Do not delete or weaken current lexicon tests.

---

## 26. Security

| Topic | Current | Target |
|---|---|---|
| Admin research | `AdminRoute` (role admin) | same + RPC `has_role` |
| Client keys | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only | same; research writes via RPC not table grants to anon |
| Connector secrets | none in `.env.example`; PubMed key unused | optional server secret `PUBMED_API_KEY` name only; never `VITE_` |
| service_role | not in `src/` | keep; import script as CI with service role **or** one-off SQL |
| Raw HTML | not injected | keep JSON text only |
| `audit_logs` | products/roles | extend actions or use `review_actions` |

RLS: `authenticated` SELECT where `status = 'approved'`; `admin` SELECT drafts; INSERT/UPDATE only through `security definer` RPCs that check admin.

---

## 27. Performance

| Surface | Current | Target |
|---|---|---|
| Lexicon list | in-memory 27 items | RPC list columns only (slug, name, evidence, regulatory) |
| Detail | full profile in bundle | RPC one slug |
| Search | client `includes` | later `pg_trgm` |
| Admin | full `listPublishedProfiles()` | paginated updates |
| Bundle | catalog ~348 kB | drop JSON from client after switch |

React Query `staleTime` 30s already used for shop; reuse for lexicon RPC.

---

## 28. Implementation Phases

Recommended order (**adjusted** from the prompt):

| Phase | Work | Why this order |
|---|---|---|
| 0 | This document; no code | — |
| 1 | Enums + `substances` + aliases + components | Identity before science |
| 2 | `product_substances` (populate from existing mapper; **no product column changes**) | Shop stays SoT |
| 3 | `research_runs` + `research_run_sources` | So later imports have run_id |
| 4 | `sources` + rejected rows | Needed before claims |
| 5 | `studies` + `study_substances` | NCT uniqueness |
| 6 | `claims` + `claim_sources` | Traceability |
| 7 | `evidence_assessments` + `regulatory_records` + history | Scalars with history |
| 8 | `community_reports` (empty) | Isolation |
| 9 | `research_updates` + `review_actions` | Admin write path |
| 10 | Import job from `published.json` | No live APIs |
| 11 | Dual-read flag + comparison tests | Safety |
| 12 | Switch lexicon detail RPC | Publishing |
| 13 | Optional JSON export; stop bundling full file | Performance |
| 14 | Server connectors writing runs (optional) | Replaces Node-only fetch |

**Do not** invert claims before sources. **Do not** put community before scientific import. **Do not** drop `published.json` in the same PR as schema.

---

## Connector inventory (current, no new connectors)

| Connector | Browser | Node | Auth | Env | Rate limit | Retry | Timeout | Persistence |
|---|---|---|---|---|---|---|---|---|
| FDA Drugs@FDA | stub | openFDA JSON | none | none | sleep 400 ms | none | fetch default | `{slug}.json` + labels file |
| FDA labels | — | openFDA label API | none | none | sequential | none | default | `{slug}.fda-label.json` |
| EMA | stub | HTTP GET EPAR URL | none | none | sequential | none | default | `ema-check.json` status only |
| BfArM | stub | not called | — | — | — | — | — | none |
| MHRA | stub | not called | — | — | — | — | — | none |
| ClinicalTrials.gov | stub | API v2 | none | none | sleep | none | default | 20 studies compact |
| PubMed | stub | E-utilities | none (`PUBMED_API_KEY` documented, unused) | optional name only | 350 ms | none | default | 15 articles |
| PubChem | — | PUG | none | none | 200 ms | none | default | CID/CAS in slug json |
| Literature | stub | via PubMed | — | — | — | — | — | — |
| Reddit | stub unavailable | **not called** | not configured | not in `.env.example` | — | — | — | none |
| Forum / Blog | stub | not called | — | — | — | — | — | none |

---

## `published.json` role

It is **not** a throwaway cache. It is the **current publishing layer and scientific SoT**. It is also a **build artifact** (imported by Vite). It is produced by compile, not by the running app. After Postgres switch it should become an **optional export**, not the writer of record.

---

## Explicit non-goals (this audit)

No Batch 03. No Reddit. No migrations. No UI. No git commit from this analysis.

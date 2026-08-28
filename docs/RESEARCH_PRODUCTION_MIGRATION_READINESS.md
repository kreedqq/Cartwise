# Research Production Migration Readiness (Phase 6A)

**Date:** 2026-08-28  
**Scope:** safety and feasibility of applying `0024`–`0027` to live Supabase. **Not applied.** No lexicon switch, dual-read, community, Batch 03, commit, or push.  
**Live project:** `cartwise-prod` (`cnjrjinvxycdkrmzcime`).  
**Git HEAD:** `60131c0` on `main` (ahead of `origin/main` by 4). Working tree dirty: Phase 2–5 files uncommitted; `0025`–`0027` untracked.

## Go / No-Go

**GO_WITH_FIXES**

Not **NO_GO**: migrations do not `ALTER`/`DROP`/`DELETE` shop or auth rows. The only shop link is `product_substances.product_id → products.id`. Seeds insert into **new** tables.

Fixes / operational conditions before or with apply:

1. Apply from this **working tree** (or commit first). `origin/main` does **not** contain `0025`–`0027`; `0024` is local-only (not pushed).
2. Apply prepared **`0028`** after `0026`/`0027` so non-admins cannot read `review-required` evidence assessments. Do **not** edit `0026`.
3. Treat product-mapping mismatches as known (lexicon still uses the client mapper). Do not “fix” SKUs in this phase.
4. Take a Supabase backup/snapshot first. Migrations are not auto-reversible.

**Do not apply** until explicitly asked.

---

## Current Live Schema

Applied: `0001`–`0023` only.

| Check | Live result (read-only) |
|---|---|
| `public.substances` | absent |
| `public.sources` / `claims` / `regulatory_records` / `review_actions` | absent |
| `products` | 320 |
| `carts` (not deleted) | 2 |
| `orders` | 0 |
| `auth.users` | 2 |
| `user_roles` admin | 1 |

Shop/auth tables continue as today. Research tables do not exist yet.

### CLI / project references

`supabase/config.toml` `project_id = "shared-cart-app"` is **local CLI**, not the production ref. Production is `cartwise-prod`. Env names only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. No secrets in this document.

Migration dir: `supabase/migrations/`. Sizes: `0024` ~21 kB, `0025` ~315 kB, `0026` ~191 kB, `0027` ~33 kB, `0028` (prepared) small.

---

## Migration Dependency Graph

```
0001 set_updated_at
0002 has_role + user_roles
0003 products
  │
0024 substances, aliases, components, product_substances
     (FK → products; INSERT identity seed; refresh mappings)
  │
0025 research_runs, sources, studies, junctions
     (FK → substances)
  │
0026 claims, claim_sources, evidence_assessments
     (FK → substances, sources, studies)
  │
0027 regulatory_records, regulatory_history, review_actions
     (FK → substances, sources, auth.users)
  │
0028 (prepared, not applied) replace evidence_assessments SELECT policy
```

Order is strict: **0024 → 0025 → 0026 → 0027** (then **0028**). Skipping a file breaks FKs and seed joins.

---

## Migration Safety

| File | CREATE TABLE | INSERT seed | ALTER existing shop | DROP | DELETE existing shop | Triggers / functions |
|---|---|---|---|---|---|---|
| 0024 | 4 new | substances 27, aliases 46, components 3; mapping SELECT from products | no | no | no | `refresh_product_substance_prefix_mappings`; `set_updated_at` triggers |
| 0025 | 7 new | sources 412, studies 118, junctions, 2 runs | no | no | no | `set_updated_at` |
| 0026 | 3 new | 294 claims, 472 claim_sources, 294 assessments | no | no | no | `set_updated_at` |
| 0027 | 3 new | 41 regulatory, 19 review_actions, 0 history | no | no | no | history trigger `SECURITY DEFINER` |

No `DROP TABLE` / `DROP COLUMN` / `DELETE FROM` / `UPDATE` on `products`, `carts`, `orders`, `profiles`, `user_roles`.

`0024` ends with `select public.refresh_product_substance_prefix_mappings();` which **only inserts** into the new `product_substances` table (`ON CONFLICT DO NOTHING`). Product columns, prices, and availability are unchanged.

Deterministic on an empty research schema. Re-running the same versioned migration is not supported (standard Supabase).

---

## Shop Isolation

Allowed relation only:

`product_substances.product_id` → `products(id)` **ON DELETE CASCADE**

Deleting a shop product later would remove mapping rows, not substances. The migration does not delete products.

Does **not** change: `products`, carts, orders, customer roles, prices, RPCs `list_shop_products` / `get_shop_product_by_code`.

---

## Auth Isolation

`has_role` is **used**, not replaced. `user_roles` / `profiles` / `auth.users` schema unchanged.

`review_actions.admin_user_id` → `auth.users(id)` **ON DELETE RESTRICT**, nullable. Seed rows use `admin_user_id` null (no invented admins).

---

## RLS Audit (0024–0027)

Policies target `authenticated`, not `anon`. No research GRANTs to `anon` in these files. Writes: `has_role(..., 'admin')`. Same GRANT+RLS pattern as 0015.

| Table | Anon | Authenticated SELECT | Admin write |
|---|---|---|---|
| substances, aliases, components, product_substances | no | yes | yes |
| sources | no | `status = active` or admin | yes |
| studies, junctions, runs | no | yes | yes |
| claims | no | `status = approved` or admin | yes |
| claim_sources | no | admin or parent claim approved | yes |
| evidence_assessments | no | admin **or parent claim approved** (see 0028) | yes |
| regulatory_records | no | current **and** approved, or admin | yes |
| regulatory_history | no | admin or parent current+approved | insert admin |
| review_actions | no | admin only | insert only (no update/delete policy) |

Admins can already SELECT `review-required` claims/assessments/regulatory via `has_role`. The Admin Research **UI** still reads `published.json` until a later phase.

---

## Evidence RLS Issue

`0026` SELECT on `evidence_assessments` follows **claim.status = approved**, not `review_status`. After seed, 294 claims are approved and **267** assessments are `review-required`. Non-admins would read those 267 rows (mostly null A–F). The 27 overlay A–F rows are already `approved`.

Admin review: already allowed.

**Fix prepared (not applied, 0026 untouched):**  
`supabase/migrations/0028_research_evidence_assessments_select_approved.sql`  
Non-admin SELECT requires `review_status = 'approved'` **and** parent claim approved. Admins unchanged.

Apply **0028 after 0026** (after 0027 is fine).

---

## Review Workflow

| Surface | After 0024–0027 | Persist approve/reject? |
|---|---|---|
| Admin UI `/admin/research` | still `reviewItems` JSON | No |
| `review_actions` | 19 `request_review`, `admin_user_id` null | Insert-only for admins |
| PostgREST | admins can SELECT review-required entities | No UI |

No invented admin user IDs.

---

## Product Mapping Differences

Client: prefix → glow name (`ghk`+`tb`+`bpc`) → fuzzy name (key length ≥ 4).  
SQL `0024`: prefix CASE + glow name only. **No fuzzy.**

Live catalog used for this matrix: 320 products (read-only). Highlighted codes:

| Code | Name | Client | SQL | Result | Resolution (later, not now) |
|---|---|---|---|---|---|
| RT5, RT10, RT20, RT30, RT40 | Retatrutide | retatrutide | retatrutide | MATCH | none |
| RT15/50/60/100 | Retatrutide | retatrutide | retatrutide | MATCH | none |
| SM5–SM30, SM2, SM500 | Semaglutide | semaglutide | semaglutide | MATCH | none |
| SMM3, SMM7 | Semaglutide | semaglutide (fuzzy) | none | DIFFERENT | optional SM prefix tweak |
| SMO5/10/15 | Sermorelin | sermorelin (fuzzy) | none (`^SM[0-9]` misses SMO) | DIFFERENT | sermorelin prefix / exclude SMO from SM |
| TR* | Tirzepatide | tirzepatide (fuzzy) | none (`^TZ` unused; codes are TR) | DIFFERENT | TR prefix if dual-read |
| LL5/10/30 | Liraglutide | liraglutide (fuzzy) | none (`^LR` unused) | DIFFERENT | LL prefix |
| BBG70 | Glow blend | glow-blend | glow-blend | MATCH | none |
| KL80 | Klow blend | glow-blend (name heuristic) | glow-blend | MATCH heuristic / UNRESOLVED identity | do not invent klow slug |
| BT5/10/20 | TB-500 (Thymosin B4 Acetate) | tb-500 (fuzzy) | none | DIFFERENT | shop label conflates TB-500 and TB4; identities stay split |
| B10F | TB-500 FRAG | tb-500 (fuzzy) | none | DIFFERENT | |
| ML10 | MT-2 | melanotan-ii (fuzzy) | none | DIFFERENT | |
| MT1 | MT-1 | melanotan-ii (prefix) | melanotan-ii | MATCH mapping / UNRESOLVED identity | Melanotan I ≠ II |
| TA5/TA10 | Thymosin Alpha-1 | thymosin-alpha-1 (fuzzy) | none | DIFFERENT | |
| IP2/5/10 | Ipamorelin | ipamorelin (fuzzy; code is IP not IPA) | none | DIFFERENT | |
| CU50/100 | GHK-CU | ghk-cu (fuzzy) | none (`^GHK` unused) | DIFFERENT | |
| IG01 / IG1 | IGF-1LR3 | likely none | none | MATCH unmapped | spacing vs “IGF-1 LR3” |
| KP5/10/500 | KPV | likely none (name length 3) | none | MATCH unmapped | |
| G2K/G5K/G10K | HCG | likely none | none | MATCH unmapped | |
| ORF6/12 | Orforglipron | orforglipron (fuzzy) | none | DIFFERENT | |
| GND2 | Gonadorelin | gonadorelin (fuzzy) | none | DIFFERENT | |
| AA10/BA03/BA10 | reconstitution water | none | none | MATCH unmapped | shop-only |

Lexicon mapping after apply remains **client** `substanceSlugForProduct`. SQL mappings are unused by the UI until dual-read. Applying `0024` does not change shop checkout.

---

## CAS / Chemical Class Gap

| Field | catalog.ts identity | published overlay | Postgres 0024 seed |
|---|---|---|---|
| molecule_type | set | may overlay | copied from catalog |
| cas_number | always null | set on many slugs (e.g. tirzepatide, orforglipron); null on others | **null** |
| chemical_class | always null | set on overlay | **null** |

Do **not** invent CAS into SQL. Overlay remains the lexicon source until a later copy/join.

---

## Data Safety

Existing products, users, carts, orders are not updated. New research rows only. Unique indexes on new tables. Hudson NCTs are not in `0025`/`0026` source/study/claim payloads (exclusion comments only).

Expected counts after a successful apply (environment-independent except mappings):

| Entity | Expected |
|---|---|
| substances | 27 |
| aliases | 46 |
| components | 3 |
| sources | 412 |
| studies | 118 |
| claims | 294 |
| claims without source | 0 |
| evidence_assessments | 294 (27 overlay A–F, 267 review-required) |
| regulatory_records | 41 |
| review_actions | 19 |
| product_substances | **environment-dependent** (prefix + glow on the 320 live SKUs) |

Integrity: 0 Hudson study/source/claim rows; 0 evidence without claim; 0 regulatory without substance/source.

Regulatory (unchanged): Orforglipron FOUNDAYO NDA220934 current US; Retatrutide not approved; TB-500 ≠ TB4; HCG urinary vs Ovitrelle non-current; Semaglutide oral title UNRESOLVED.

---

## Rollback Plan

Supabase migrations do not auto-down.

**Emergency UI rollback:** keep `VITE_RESEARCH_DB_MODE=legacy` (default). Lexicon stays `catalog.ts` + `published.json`. Applying 0024–0027 does not switch the client.

**Schema rollback (manual, DBA, after backup):** drop in reverse — `review_actions`, `regulatory_history`, `regulatory_records`, `evidence_assessments`, `claim_sources`, `claims`, study/source junctions, `studies`, `sources`, `research_runs`, `product_substances`, `substance_components`, `substance_aliases`, `substances`, plus `0028` policy if applied, plus `regulatory_records_write_history` / `refresh_product_substance_prefix_mappings`. **Do not** drop `products` or `auth` objects.

---

## Pre-Apply Checklist

- [ ] Snapshot / PITR backup of `cartwise-prod`
- [ ] Confirm working tree includes `0024`–`0027` (and `0028` if adopting the RLS fix)
- [ ] `origin/main` is **not** the apply source until committed/pushed
- [ ] Order 0024 → 0025 → 0026 → 0027 → 0028
- [ ] No shop/auth DDL in those files (verified)
- [ ] Seed joins `substances.slug` and `sources.legacy_ids`
- [ ] Lexicon env remains `legacy`
- [ ] Rollback path documented

---

## Production Apply Plan (do not execute now)

1. **Backup / snapshot** the live project.  
2. **Apply 0024.**  
3. **Validate:** 27 substances, 46 aliases, 3 components; `products` count still 320; sample `select count(*) from products`.  
4. **Apply 0025.**  
5. **Validate:** 412 sources, 118 studies; Hudson NCT counts 0 on those tables.  
6. **Apply 0026.**  
7. **Validate:** 294 claims, 294 assessments, 0 claims without sources.  
8. **Apply 0027.**  
9. **Validate:** 41 regulatory rows, 19 review_actions, FOUNDAYO NDA220934, 0 `not_approved`.  
10. **Apply 0028** (prepared RLS fix).  
11. Confirm lexicon still file-based.

Stop if any validate step fails; do not continue the chain.

---

## Validation Queries (read-only after apply; not run as writes)

```sql
-- existence
select to_regclass('public.substances'), to_regclass('public.sources'),
       to_regclass('public.claims'), to_regclass('public.regulatory_records');

-- counts
select 'substances' as t, count(*) from substances
union all select 'aliases', count(*) from substance_aliases
union all select 'sources', count(*) from sources
union all select 'studies', count(*) from studies
union all select 'claims', count(*) from claims
union all select 'evidence', count(*) from evidence_assessments
union all select 'regulatory', count(*) from regulatory_records
union all select 'review_actions', count(*) from review_actions;

-- integrity
select count(*) as claims_without_sources
from claims c where not exists (select 1 from claim_sources cs where cs.claim_id = c.id);

select count(*) as hudson_sources from sources
where nct_id in ('NCT07487363','NCT07437560') or legacy_ids && array['NCT07487363','NCT07437560'];

select count(*) as hudson_studies from studies
where nct_id in ('NCT07487363','NCT07437560');

select count(*) as shop_products from products; -- must remain 320
```

Pre-apply (already run, read-only): research `to_regclass` is null; products = 320.

---

## Known Issues

- `0025`–`0027` (and `0028`) are not on `origin/main`; `0024` is not pushed.
- Evidence SELECT in `0026` is too wide for non-admins until `0028`.
- SQL vs client mapping diverges for TR/LL/IP/CU/SMO/TA/BT/fuzzy SKUs.
- Overlay CAS/class not in `substances`.
- Two regulatory UNRESOLVED rows remain.
- Admin UI still JSON.
- `SECURITY DEFINER` helpers stay in `public` (existing project pattern).
- Large JSON seeds (`0025` ~315 kB) may need a long statement timeout; still a single deterministic migration.

## Recommended Next Step

When asked: snapshot, apply `0024`→`0027`, then `0028`, validate counts. **Do not** enable dual-read or switch the lexicon.

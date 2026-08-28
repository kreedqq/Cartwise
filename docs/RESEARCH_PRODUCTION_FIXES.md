# Research Production Fixes (Phase 6B)

**Date:** 2026-08-28  
**Scope:** fix only the Phase 6A readiness issues. **Not applied** to live. No dual-read, lexicon switch, community, Batch 03, commit, or push.  
**Live project:** `cartwise-prod` (`cnjrjinvxycdkrmzcime`).  
**Git HEAD:** `60131c0` on `main` (ahead of origin). Working tree still dirty (Phases 2–6B).

## Verdict

**READY_TO_APPLY**

Conditions: apply **this working tree** in order `0024 → 0025 → 0026 → 0027 → 0028 → 0029`. Take a snapshot first. Do **not** apply until explicitly asked.

`0028` is the evidence RLS fix only. Explicit `product_substances` rows are **`0029`** so `0028` stays SELECT-policy-only as required.

---

## RLS Fix

`0026` SELECT on `evidence_assessments` allows any authenticated user when the parent **claim** is `approved`. After seed, all 294 claims are approved and **267** assessments are `review-required`. Non-admins would see those rows.

**`0026` is unchanged.**

Prepared `supabase/migrations/0028_research_evidence_assessments_select_approved.sql`:

| Role | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| Admin (`has_role(..., 'admin')`) | all assessments, including `review-required` | admin-only (still `0026`) |
| Authenticated non-admin | `review_status = 'approved'` **and** parent claim `approved` | denied by `0026` policies |
| Anon / unauthenticated | no policy, no GRANT | no policy, no GRANT |

Writes stay on `0026` (`evidence_assessments_write_admin` / `_update_admin` / `_delete_admin`). `0028` does not add INSERT/UPDATE/DELETE.

---

## Mapping Principle

Do not copy the client fuzzy mapper into SQL. Do not copy prefix CASE into the client.

Future source of truth:

`products` → `product_substances` → `substances`

`substanceSlugForProduct` remains the **legacy fallback** (lexicon still uses it). Not removed.

`0024` still inserts prefix + glow-name rows. `0029` adds **manual** rows for unambiguous live SKUs and **deletes** unsafe prefix/glow hits (`MT1`, `KL80`) from `product_substances` only.

---

## Mapping Analysis

Live catalog: **320** products (read-only, 2026-08-28). Client = `substanceSlugForProduct`. SQL 0024 = prefix CASE + glow name. Database = intended Postgres after `0024`+`0029` (`postgresMappingSlug`).

### Named SKUs (audit)

| Code | Product name | Client | SQL 0024 | Database | Expected | Confidence | Match |
|---|---|---|---|---|---|---|---|
| RT5 | Retatrutide | retatrutide | retatrutide | retatrutide | retatrutide | high | MATCH |
| RT10 | Retatrutide | retatrutide | retatrutide | retatrutide | retatrutide | high | MATCH |
| RT20 | Retatrutide | retatrutide | retatrutide | retatrutide | retatrutide | high | MATCH |
| RT30 | Retatrutide | retatrutide | retatrutide | retatrutide | retatrutide | high | MATCH |
| RT40 | Retatrutide | retatrutide | retatrutide | retatrutide | retatrutide | high | MATCH |
| TR10 | Tirzepatide | tirzepatide (fuzzy) | none (`^TZ`) | tirzepatide (manual) | tirzepatide | high | MATCH (client=DB; SQL 0024 differed) |
| SMO5 | Sermorelin Acetate | sermorelin (fuzzy) | none (`^SM[0-9]` misses SMO) | sermorelin (manual) | sermorelin | high | MATCH (client=DB; SQL 0024 differed) |
| TA5 | Thymosin Alpha-1 | thymosin-alpha-1 (fuzzy) | none | thymosin-alpha-1 (manual) | thymosin-alpha-1 | high | MATCH (client=DB; SQL 0024 differed) |
| BT5 | TB-500 (Thymosin B4 Acetate) | tb-500 (fuzzy) | none | none | unresolved | unresolved | DIVERGE |
| ML10 | MT-2 (Melanotan 2 Acetate) | melanotan-ii (fuzzy) | none | melanotan-ii (manual) | melanotan-ii | high | MATCH (client=DB; SQL 0024 differed) |
| BBG70 | (GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend | glow-blend | glow-blend | glow-blend | glow-blend | high | MATCH |

Same expected/database for TR5–TR500, SMO10/15, TA10, RT15/50/60/100 (prefix MATCH).

### Explicit manual maps (0029)

High-confidence live code + name → one catalog slug. `mapping_method = 'manual'`. Products/prices/carts/orders unchanged.

| Codes | Name | Slug |
|---|---|---|
| TR5, TR10, TR15, TR20, TR30, TR40, TR50, TR60, TR100, TR120, TR500 | Tirzepatide | tirzepatide |
| SMO5, SMO10, SMO15 | Sermorelin Acetate | sermorelin |
| TA5, TA10 | Thymosin Alpha-1 | thymosin-alpha-1 |
| ML10 | MT-2 (Melanotan 2 Acetate) | melanotan-ii |
| SMM3, SMM7 | Semaglutide | semaglutide |
| LL5, LL10, LL30 | Liraglutide | liraglutide |
| IP2, IP5, IP10 | Ipamorelin | ipamorelin |
| CU50, CU100 | GHK-CU | ghk-cu |
| ORF6, ORF12 | Orforglipron | orforglipron |
| GND2 | Gonadorelin | gonadorelin |
| TSM5, TSM10, TSM20 | Tesamorelin | tesamorelin |
| CGL5, CGL10, CGL20 | Cagrilintide | cagrilintide |
| MDT5, MDT10 | Mazdutide | mazdutide |
| SK5, SK10, SK30 | Selank | selank |
| XA5, XA10, XA30 | Semax | semax |
| MS10, MS40 | MOTS-C | mots-c |
| KP5, KP10, KP500 | KPV | kpv |
| CD2, CD5, CD10, CND2, CND5, CND10 | CJC-1295 With/Without DAC | cjc-1295 |
| BC2, BC5, BC10, BC20, BC500, B157 | BPC / BPC157 | bpc-157 |
| 2AD, 5AD, 10AD | AOD9604 | aod-9604 |
| IG1, IG01 | IGF-1LR3 | igf-1-lr3 |
| G2K, G5K, G10K | HCG | hcg |
| H06, H10, H12, H15, H24, H36, H50 | HGH | somatropin |

Prefix-covered families left on `0024` (not duplicated as manual unless the prefix missed): RT*, SM*+digit, glow BBG70.

### Unresolved (not mapped)

| Code | Name | Reason |
|---|---|---|
| BT5, BT10, BT20 | TB-500 (Thymosin B4 Acetate) | Label mixes TB-500 and Thymosin Beta-4 |
| B10F | TB-500 (FRAG) | Fragment plus TB-500/TB4 mix |
| MT1 | MT-1 | Melanotan I ≠ Melanotan II; `0024` prefix unmapped in `0029` |
| KL80 | (KLOW) … extra TB500 | Not the glow-blend identity; glow heuristic unmapped in `0029` |
| BB10, BB20, BB500 | BPC+TB500 blends | Two substances; no blend slug |
| RC10 | Retatrutide+Cagrilintide | Two INNs |
| CS10 | Cagrilintide+Semaglutide | Two INNs |
| CP10, CP20 | CJC-1295 + IPA | Two substances |
| TI18 | Tesamorelin+Ipamorelin | Two substances |
| XS20 | Semax+Selank | Two substances |
| FR2, FR5, FR10 | HGH Fragment 176-191 | Fragment ≠ somatropin |
| NSK30 | NA Selank amide | Modified analogue |
| NXA30 | NA Semax amide | Modified analogue |

Not guessed: GHRP-2/6, DSIP, Epithalon, oils/orals, reconstitution water, H100 Tren Hex, G75 HMG, CD50 Clomiphene, TER10 Teriparatide, TY10 Thymalin, AHK-CU, and other shop-only SKUs with no catalog identity.

---

## Mapping Differences (client vs Postgres after 0029)

Lexicon still uses the client mapper. These live SKUs would **disagree** if dual-read used Postgres:

| Code | Client | Database | Notes |
|---|---|---|---|
| BT5, BT10, BT20 | tb-500 | unresolved | Do not guess TB-500 vs TB4 |
| B10F | tb-500 | unresolved | Fragment |
| MT1 | melanotan-ii (`^MT2?`) | unresolved | Melanotan I |
| KL80 | glow-blend (name heuristic) | unresolved | Klow ≠ Glow |
| BB10, BB20, BB500 | bpc-157 (name contains BPC157) | unresolved | Blend |
| RC10 | retatrutide | unresolved | Blend |
| CS10 | semaglutide (first catalog name hit) | unresolved | Blend |
| CP10, CP20 | cjc-1295 | unresolved | Blend |
| TI18 | tesamorelin | unresolved | Blend |
| XS20 | semax | unresolved | Blend |
| NSK30 | selank | unresolved | Amide |
| NXA30 | semax | unresolved | Amide |

TR / SMO / TA / ML10 / SMM / LL / IP / CU / ORF / … : client fuzzy and Postgres manual now **agree**. SQL 0024 prefix alone still misses those codes (documented; `0029` fills them).

---

## Explicit Mapping Plan

1. Apply `0024` (prefix + glow inserts into `product_substances` only).
2. Apply `0025`–`0028` (science + evidence SELECT).
3. Apply `0029`: `INSERT … mapping_method = 'manual'` for unambiguous SKUs; `DELETE` mapping rows for `MT1` and `KL80`.
4. Leave the client mapper in place.
5. Later dual-read should prefer `product_substances`, not fuzzy names.

Source lists: `src/lib/peptide/persistence/explicitProductMappings.ts`, `liveShopProducts.ts`.

---

## Migration Order

```
0024 identity + prefix/glow product_substances
  → 0025 sources / studies / runs
  → 0026 claims / evidence
  → 0027 regulatory / review_actions
  → 0028 evidence_assessments SELECT (RLS only)
  → 0029 explicit product_substances + unmap MT1/KL80
```

Skipping a file breaks FKs or leaves the 6A evidence leak / mapping gaps.

### Safety (0024–0029)

| File | Shop/auth mutation | Notes |
|---|---|---|
| 0024 | none | FK `product_substances.product_id → products(id)` ON DELETE CASCADE; refresh **inserts** mapping rows only |
| 0025 | none | new research tables + seed |
| 0026 | none | evidence SELECT too wide until 0028 |
| 0027 | none | `review_actions.admin_user_id → auth.users` ON DELETE RESTRICT; seed `admin_user_id` null |
| 0028 | none | DROP/CREATE one policy on `evidence_assessments` |
| 0029 | none | INSERT/DELETE on `product_substances` only |

No `ALTER`/`UPDATE`/`DELETE` on `products`, `carts`, `orders`, `profiles`, `user_roles`. `has_role` is used, not replaced. Product import tables (`pdf_imports`) untouched.

---

## Snapshot / Backup Plan (not executed)

Do this **before** any apply. Do **not** run apply in this phase.

### Current live baseline (read-only, 2026-08-28)

| Item | Value |
|---|---|
| Project | cartwise-prod / `cnjrjinvxycdkrmzcime` |
| Applied migrations | `0001`–`0023` only |
| `products` | 320 |
| `carts` with `deleted_at is null` | 2 |
| `carts` all rows | 6 |
| `orders` | 0 |
| `auth.users` | 2 |
| `user_roles` admin | 1 |
| `public.substances` (and other research tables) | **absent** |
| Auth schema / `has_role` | unchanged |

### Snapshot steps (when asked to apply)

1. Supabase Dashboard → Project → **Database backups** (PITR if enabled) **or** a manual backup.
2. Optional `pg_dump` of `public` + `auth` (roles/grants) to an offline file. No secrets in git.
3. Record counts above in the apply log.
4. Confirm `schema_migrations` max version is `0023`.
5. Confirm research `to_regclass('public.substances')` is null.
6. Only then apply 0024.

If snapshot/backup cannot be confirmed: **STOP**.

---

## Production Apply Plan (not executed)

Preflight:

- Working tree contains `0024`–`0029` (origin/main does not).
- `VITE_RESEARCH_DB_MODE` stays `legacy` (default). Lexicon stays files.
- Snapshot complete.
- No concurrent product import.

Then, one file at a time. **On any error: STOP.** Do not continue to the next file. Do not “fix forward” on live.

| Step | Action | Validation before next |
|---|---|---|
| 0 | Snapshot | counts + migration 0023 + research absent |
| 1 | Apply `0024` | substances 27, aliases 46, components 3; products still 320; carts/orders unchanged; `has_role` exists |
| 2 | Apply `0025` | sources 412, studies 118; 0 Hudson NCT study rows |
| 3 | Apply `0026` | claims 294, assessments 294; **do not stop here for production traffic** if non-admins can hit PostgREST evidence |
| 4 | Apply `0027` | regulatory 41, review_actions 19 |
| 5 | Apply `0028` | evidence SELECT policy includes `review_status = 'approved'`; admin still `has_role` |
| 6 | Apply `0029` | TR/SMO/TA/ML10 mapped; BT/MT1/KL80 unmapped; products row images unchanged |

---

## Post-Apply Validation

Do **not** run these against live until apply is requested. Checks:

**Schema:** tables `substances`, `substance_aliases`, `substance_components`, `product_substances`, `research_runs`, `sources`, `studies`, `claims`, `claim_sources`, `evidence_assessments`, `regulatory_records`, `regulatory_history`, `review_actions` exist with expected columns.

**FKs:** `product_substances.product_id` → `products`; claims → substances/sources; regulatory → substances/sources; `review_actions.admin_user_id` → `auth.users`.

**Indexes:** unique slugs, unique `(product_id, substance_id)`, unique claim/assessment keys.

**RLS:** enabled on research tables. Evidence SELECT is the **0028** policy. No anon GRANTs on research tables.

**Row counts:** see Expected Counts.

**Orphans:** assessments without claims = 0; claim_sources without claim/source = 0; regulatory without substance = 0.

**Duplicates:** unique source identifiers; unique `(product_id, substance_id)`.

**Shop integrity:** products 320; no column changes; prices unchanged; carts 2 active / 6 total (unless users changed them independently); orders 0.

**Auth integrity:** 2 users; 1 admin; login/session/`has_role` unchanged.

---

## Expected Counts

After a successful apply (research seed; mappings environment-dependent):

| Entity | Expected |
|---|---|
| substances | 27 |
| aliases | 46 |
| components | 3 |
| unique sources | 412 |
| studies | 118 |
| claims | 294 |
| evidence_assessments | 294 (27 overlay A–F approved, 267 review-required) |
| regulatory_records | 41 |
| review_actions | 19 |
| product_substances | environment-dependent (0024 prefix/glow + 0029 manual − MT1/KL80) |

---

## Shop Safety

| Surface | Change in 0024–0029 |
|---|---|
| `products` rows/columns/SKU/name/price | none |
| carts / cart_items | none |
| orders / order_items | none |
| selling-price RPCs | none |
| product import (`pdf_imports`) | none |
| `product_substances` | new table + inserts/deletes of **mapping rows only** |

Regression tests (SQL parse, `src/tests/researchProductionFixes.test.ts`): migrations do not `ALTER`/`UPDATE`/`DELETE` shop tables.

---

## Auth Safety

| Surface | Change |
|---|---|
| Login / Discord OAuth / session | none |
| `has_role` function body | none (used, not replaced) |
| `user_roles` / admin role | none |
| `auth.users` | none (nullable FK from `review_actions` only) |

---

## Known Issues

- Live apply still **not done**. Lexicon still `catalog.ts` + `published.json`.
- Client mapper still fuzzy; diverges on unresolved blends/BT/MT1/KL80/amides.
- `origin/main` does not contain 0025–0029; `0024` is local-only.
- CAS/chemical_class still null in identity seed (overlay remains lexicon source).
- 267 evidence assessments remain review-required (intentional).
- Two regulatory UNRESOLVED rows unchanged (hCG/Ovitrelle, oral semaglutide title).
- Community not persisted.
- `supabase/config.toml` `project_id = shared-cart-app` is local CLI, not prod ref.

---

## Files

- `supabase/migrations/0028_research_evidence_assessments_select_approved.sql`
- `supabase/migrations/0029_research_explicit_product_mappings.sql`
- `src/lib/peptide/persistence/explicitProductMappings.ts`
- `src/lib/peptide/persistence/liveShopProducts.ts`
- `src/lib/peptide/persistence/sqlProductMapping.ts`
- `src/tests/researchProductionFixes.test.ts`

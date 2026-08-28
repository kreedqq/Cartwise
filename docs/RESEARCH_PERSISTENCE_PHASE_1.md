# Research Persistence Phase 1

**Date:** 2026-08-28  
**Scope:** identity tables + product mapping only.  
**Baseline:** `837b155`  
**No git commit.** Lexicon still reads `catalog.ts` + `published.json`.

## Migration

`supabase/migrations/0024_research_identity_and_product_mapping.sql`

Does **not** ALTER `products` columns, prices, carts, or orders. `product_substances.product_id` references `products(id)` ON DELETE CASCADE.

## Tables

| Table | Purpose |
|---|---|
| `substances` | Scientific identity (slug, name, category, molecule_type, cas_number nullable, identity_note, **status** lifecycle) |
| `substance_aliases` | Confirmed aliases / development names |
| `substance_components` | Blend → component FKs |
| `product_substances` | Shop SKU → substance (no price copy) |

### Columns of note

`substances.status`: `active` \| `deprecated` \| `merged` \| `placeholder` \| `blend`. **Not** evidence A–F.

`cas_number` and `chemical_class` are null in the seed (identity catalog; published overlay not imported).

### Indexes / uniqueness

- `substances.slug` unique  
- `substance_aliases (substance_id, lower(trim(alias)))` unique  
- `substance_aliases (lower(trim(alias)))` unique globally (prevents TB-500 as an alias of Thymosin Beta-4)  
- `substance_components (blend_id, component_id)` unique  
- `product_substances (product_id, substance_id)` unique  

### RLS

Authenticated: SELECT.  
Admin (`has_role(..., 'admin')`): INSERT/UPDATE/DELETE.  
Service role: full table grants (same pattern as 0015).  
Function `refresh_product_substance_prefix_mappings()`: admin or service-role (uid null).

## Imported identity (from `catalog.ts`, 27 rows)

All current identity slugs. Glow-blend `status = blend`, `molecule_type = blend`.

**Aliases:** 46 (common_name + development_name).  
**Blend components:** 3 (glow-blend → ghk-cu, tb-500, bpc-157).

## Product mappings

SQL copies **prefix rules** from `search.ts` plus the glow-blend **name** rule (`ghk`+`tb`+`bpc` in the product name). Existing products matching those patterns are inserted at migrate time via `refresh_product_substance_prefix_mappings()`.

The client mapper `substanceSlugForProduct` is **unchanged** and remains the lexicon/shop mapping path.

Fuzzy name fallback in the client (substring ≥ 4 characters) is **not** imported into SQL (ambiguous).

RT5 / RT10 / RT20 / RT30 / RT40 map to retatrutide **if those codes exist** in `products` (`code ~* '^RT[0-9]'`). No SKUs were invented.

### Orphans (expected)

- Shop SKUs without a prefix/glow name (oils, orals, BAC/AA water, unknown codes) → no `product_substances` row.  
- Substances without shop products (e.g. semax, selank, gonadorelin) → identity only.  
- Count of live mappings depends on the deployed `products` table and is not baked into Git.

### Duplicates

None in the identity seed. Global alias uniqueness enforced.

## Dual read

`VITE_RESEARCH_DB_MODE` (`legacy` default \| `postgres`). Phase 1 lexicon **does not** read Postgres. `researchDbMode()` / `lexiconUsesPostgresIdentity()` are helpers only.

## Validation vs catalog.ts

Tests compare seed slugs/aliases to `PEPTIDE_SUBSTANCES_IDENTITY` and assert the SQL file contains each slug/alias.

## Tests

`src/tests/researchPersistencePhase1.test.ts` (identity, aliases, uniqueness, RT mapping, glow-blend, TB-500 / Melanotan II / IGF-1 LR3 separations, dual-read default `legacy`). Existing lexicon/shop tests unchanged.

Gates (2026-08-28): typecheck pass; lint 0 errors / 5 existing warnings; 290 tests / 24 files; production build pass. Lexicon catalog chunk still ~348 kB (`published.json`).

## Known issues

- Live `product_substances` row counts are environment-specific until the migration is applied.  
- Client `/^MT2?/i` can match `MT` + digit; SQL seed uses `^MT2` or `^MT[0-9]` (slightly tighter).  
- A glow blend SKU whose **code** starts with `GHK` would prefix-map to `ghk-cu` (same as current client prefix order).  
- `published.json` overlay (CAS, evidence) is intentionally **not** in these tables.

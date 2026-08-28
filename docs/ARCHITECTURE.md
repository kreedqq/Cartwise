# Architecture

Peptix is a **Vite + React 19 + TypeScript** SPA. Backend is **Supabase** (Postgres + RLS + Auth + Storage + Edge Functions). Styling: Tailwind + Radix primitives. Data fetching: TanStack Query. Routing: React Router 6.

```
Browser (Peptix SPA)
  ├─ Auth (GoTrue) ── Discord OAuth / email
  ├─ RPCs / tables (shop, carts, orders) ── RLS
  ├─ Edge: get-exchange-rate, set-user-role
  └─ Peptide platform (client modules + published.json)
       ├─ Identity also seeded to Postgres (Phase 1; lexicon still reads files)
       └─ Node scripts (official APIs) → cache → compile (not called from the browser)
```

Hosting: `vercel.json` SPA rewrites; GitHub Pages workflow can set `VITE_BASE_PATH`.

## Frontend layout

- `src/pages/` — route screens
- `src/components/layout/` — AppShell, Sidebar, MobileNav, Topbar, AdminNav, BrandMark
- `src/components/shop|cart|orders|auth|admin|ui/`
- `src/hooks/` — React Query wrappers
- `src/services/` — Supabase RPC/table access for **shop**
- `src/lib/peptide/` — calculator, identity catalog, mapping, published profiles
- `src/research/` — connector types, engine, queries, fetch cache

## Authentication

`AuthProvider` + `ProtectedRoute` / `AdminRoute`. Discord OAuth uses `skipBrowserRedirect` and never assigns GoTrue JSON to `window.location`. Anon key is public; authorization is RLS + RPCs.

## Shop vs peptide

| Shop (Postgres) | Lexicon (client, Phase 1) |
|---|---|
| `products` SKU, `price_usd`, bulk, availability | `PeptideSubstance` + `SubstanceProfile` from `catalog.ts` + `published.json` |
| Cart / checkout / orders | Sources, studies, evidence, community disclaimer |
| `list_shop_products` | File overlay; Postgres identity is **not** the lexicon read path yet |
| `product_substances` (SKU → substance, no prices) | Client `substanceSlugForProduct` prefix/name mapping still live |

Mapping is dual: client prefix/name **and** `product_substances`. Lexicon UI must not render prices or cart actions.

## Database (Postgres)

Defined in `supabase/migrations/` (0001–0024). Hand-mirrored in `src/types/database.ts`.

**Auth-adjacent:** `profiles`, `user_roles` (`user` \| `admin`).

**Catalog:** `products`, `product_price_history`. Selling prices for the current user come from RPCs (`list_shop_products`), not a raw table select of list prices.

**Cart:** `carts`, `cart_items` (version/optimistic lock, `price_tier` bulk/normal). View `cart_summaries`.

**Orders:** `orders`, `order_items`, `order_status_history`, `order_admin_notes`. Shipping fields (China/DE) from 0020+.

**Customers:** `customer_roles`, `user_customer_roles`.

**Other:** `product_favorites`, `order_templates`, `order_template_items`, `exchange_rates`, `pdf_imports`, `pdf_import_rows`, `audit_logs`.

**Research identity (Phase 1, 0024):** `substances`, `substance_aliases`, `substance_components`, `product_substances`. RLS: authenticated SELECT; admin write via `has_role`. Shop `products` columns were not altered.

There are **no** SQL tables for source/study/community/research_update. Those remain TypeScript + `published.json`. Dual-read flag: `VITE_RESEARCH_DB_MODE` (`legacy` default). See `docs/RESEARCH_PERSISTENCE_PHASE_1.md`.

## Peptide / research data models

### SUBSTANCE (`PeptideSubstance` + overlay)

Identity fields live in `catalog.ts` (always start at evidence F / regulatory insufficient). `applyPublishedProfile` overwrites evidence, regulatory, CAS, dates, description when a published profile exists.

### PRODUCT (shop)

Postgres `products`. Lexicon only stores `PeptideProductRef` (code, name, strength label, slug, blend flag) derived at runtime from shop rows — still without prices in the UI.

### SOURCE (`ProfileSource` / `PeptideSource`)

Curated in `published.json`: title, URL, publisher, dates, DOI, PMID, NCT, `sourceType`, `sourceQuality` 1–5, `accessDate`. Search-count rows are `scientific` (not primary trials). Community types: blog, reddit, forum, community.

Approved-label profiles store `regulatoryRegions` (e.g. US, EU). Audit findings that are not auto-resolved are `reviewItems` (priority, topic, note, sourceIds) and appear in Admin Research. Batch 02 compile applies title/sponsor filters (`keepStudy` / `keepArticle`) so noisy CT.gov/PubMed hits are not published. Shop blends (`glow-blend`) compile as mapping-only profiles, not unique INNs.

**Completeness vs review (two layers, not one enum):**

There is **no** TypeScript field `researchComplete` / `partial`. Published profiles store `reviewStatus`: `fresh` | `recently-updated` | `review-recommended` | `review-required` | `incomplete`.

Batch reports may also assign a **mutually exclusive primary research status** (documentation only):

1. If `reviewStatus === "review-required"` → **Review Required** (wins even if the file is otherwise thin or well sourced).
2. Else if validated substance-specific literature/trials are too thin or too noisy → **Partial**.
3. Else (workflow done: identity, sources, evidence, regulatory without inventing “not approved”, citations, `lastReviewedAt`) → **Research Complete**.

`review-recommended` is **not** Review Required. A substance is not counted twice: gonadorelin is Review Required (and the file is also thin); thymosin-alpha-1 is Review Required (workflow otherwise complete); igf-1-lr3 is Partial (`review-recommended` only).

### STUDY (`ProfileStudy` / `PeptideStudy`)

NCT ID, title, phase, status, sponsor, enrollment, dates, `hasResults`, URL. Deduped by NCT. Mock-titled trials excluded at compile time.

### COMMUNITY_REPORT

Type exists (`CommunityReport`). **No published community reports** in the current batch. UI shows unavailable + disclaimer. Classification enum: anecdotal / repeated-anecdotal / mixed-anecdotal / unverified.

### RESEARCH_UPDATE

Type + `createResearchDraft` / `canPublish` in `src/research/engine.ts`. Admin queue has no persisted draft rows yet (empty queue copy; reports are compiled profiles).

### Relationships (logical)

```
Product.code ──client prefix/name──► Substance.slug (catalog.ts)
Product.id   ──product_substances──► substances.id (Postgres, Phase 1)
Substance ──1:n──► Source          (still published.json)
Substance ──1:n──► Study (NCT)     (still published.json)
Substance ──1:n──► CommunityReport (none published)
Source ──n:1──► Substance
Community ─x─► EvidenceLevel   (forbidden; communityCannotRaiseEvidence)
```

## Connector architecture

`ResearchConnector` in `src/research/connectors/types.ts`.

Scientific (browser stubs): FDA, EMA, BfArM, MHRA, ClinicalTrials.gov, PubMed, literature.

Community stubs: Reddit, forum, blog.

Node (not bundled as live client calls): `scripts/fetch-research-sources.mjs` (`batch01` / `batch02` / `all`), `scripts/fetch-regulatory-labels.mjs`, `scripts/compile-research-profiles.mjs` + `scripts/research-batch-02-curated.mjs`.

## Caching

- Shop/orders: React Query `staleTime` 30s
- Exchange rate: DB + edge function
- Research: file cache `src/research/cache/fetched/` + compiled `published.json` (content not re-fetched on page load)

## Security notes

- No service_role in `src/`
- External HTML is not injected from connector payloads; lexicon text is curated JSON
- JSON-LD on lexicon detail is `WebPage` only (no fake ratings)

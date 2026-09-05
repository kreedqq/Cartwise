# Architecture

Peptix is a **Vite + React 19 + TypeScript** SPA. Backend is **Supabase** (Postgres + RLS + Auth + Storage + Edge Functions). Styling: Tailwind + Radix primitives. Data fetching: TanStack Query. Routing: React Router 6.

```
Browser (Peptix SPA)
  ├─ Auth (GoTrue) ── Discord / Telegram OAuth / email
  ├─ RPCs / tables (shop, carts, orders) ── RLS
  ├─ Edge: get-exchange-rate, set-user-role, send-tracking-email
  └─ Peptide platform
       ├─ Public lexicon (Phase 11): Postgres primary + exclusive file fallback
       ├─ Identity also in catalog.ts (fallback + category overlay)
       ├─ Sources/studies/claims/regulatory live on cartwise-prod (0024–0030; Batch 03 review-required held)
       ├─ Dual-read: `legacy` files only; `postgres` exclusive public; `dual` compare-only, never mixed
       ├─ Admin Dual Read copy: Postgres primary + exclusive fallback
       ├─ Admin Research (Phase 8): Postgres primary (`review_actions` append-only)
       ├─ Production SPA: `https://peptix.app` (Vercel project `cartwise`; GitHub `kreedqq/Cartwise` `main`)
       ├─ Phase 12 post-cutover audit: PRODUCTION_POST_CUTOVER_PASS_WITH_LIMITATIONS
       ├─ Node scripts (official APIs) → cache → compile (not called from the browser)
       ├─ Batch 03 scan cache: `src/research/cache/fetched/batch03/` (imported as review-required on prod; not auto-approved)
       ├─ Phase 14: BATCH_03_REVIEW_READY_WITH_LIMITATIONS
       ├─ Phase 15: BATCH_03_REVIEW_INTAKE_READY_WITH_LIMITATIONS
       ├─ Phase 17: PRODUCTION_0030_APPLY_SUCCESS_WITH_RLS_LIMITATION (live 0030 + 104/36 intake; SPA not redeployed)
       ├─ Block 2 Update Engine: RESEARCH_UPDATE_ENGINE_READY_WITH_LIMITATIONS (`src/lib/peptide/research/updateEngine/`)
       ├─ Block 3 Research Operations: RESEARCH_OPERATIONS_READY_WITH_LIMITATIONS (`src/lib/peptide/research/operations/`)
       └─ Final hardening: FINAL_RELEASE_READY_WITH_LIMITATIONS (`docs/RESEARCH_FINAL_HARDENING.md`) — persist no longer demotes UNCHANGED approved sources; Claim Sources vs Source References
- Production dump 2026-08-29-1130: `Documents\PEPTIX-BACKUPS\PEPTIX-PRODUCTION-FINAL-2026-08-29-1130.sql`
```

Hosting: Vercel (`vercel.json` `npm run build`, output `dist`, SPA rewrite except `/assets/`). Recovery: `docs/RECOVERY.md`. Env names only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. GitHub Pages workflow can still set `VITE_BASE_PATH` but production is `peptix.app`.

**Admin Bestellzusammenfassung:** `AdminOrderSummary` calls `buildProcessingOrderSummary` (processing orders only) with `useAdminKitOrderContext`. Händler `groups` and BESTELLUNGEN `personLines` share `kitProgress` per real `kit_share_id`. PDF (`peptixOrderSummaryPdf.ts`) prints the same `quantityLabel`. Individual Geteiltes Kit stays per-share (`5/10 Kit`). Quantity words: `src/lib/quantityFormat.ts`.

## Frontend layout

- `src/pages/` — route screens
- `src/components/layout/` — AppShell, Sidebar, MobileNav, Topbar, AdminNav (five hubs + in-page `AdminSectionTabs`), BrandMark
- `src/components/shop|cart|orders|auth|admin|ui/`
- `src/hooks/` — React Query wrappers
- `src/services/` — Supabase RPC/table access for shop and admin research
- `src/lib/peptide/` — calculator, identity catalog, mapping, published profiles, dual-read, public lexicon read, admin research workflow, update engine, research operations
- `src/research/` — connector types, engine, queries, fetch cache

## Authentication

`AuthProvider` + `ProtectedRoute` / `UsernameGate` / `AdminRoute`. Discord and Telegram (`custom:telegram`) OAuth use `skipBrowserRedirect` and never assign GoTrue JSON to `window.location`. Password login does not navigate to `/dashboard` until AuthProvider has a session. After a session exists, `UsernameGate` sends users with a missing `profiles.username` or `username_required_on_next_login` to `/username-required` (outside `AppShell`). OAuth callback (`completeOAuthCallback`) keeps a session if `exchangeCodeForSession` fails after `detectSessionInUrl` already consumed the code. Telegram login does not merge accounts by username. Anon key is public; authorization is RLS + RPCs. Production Site URL must be `https://peptix.app` (not localhost). Admin user delete is `admin_delete_user` (admin-only SECURITY DEFINER); it does not cascade-delete orders.

## Shop vs peptide

| Shop (Postgres) | Lexicon (Postgres public read + file fallback) / Admin Research (Postgres) |
|---|---|
| `products` SKU, `price_usd`, bulk, availability | `PeptideSubstance` + `SubstanceProfile` from Postgres (`usePublicLexicon`) or exclusive `catalog.ts` + `published.json` fallback |
| Cart / checkout / orders | Sources, studies, evidence, community disclaimer |
| `list_shop_products` | Public path: approved claims/evidence/regulatory only |
| `product_substances` (SKU → substance, no prices; live after 0024+0029) | Client `substanceSlugForProduct` prefix/name mapping still used by lexicon (legacy fallback) |

Mapping is dual: client prefix/name **legacy fallback** and `product_substances` (intended SoT after apply). Lexicon UI must not render prices or cart actions. Unresolved shop labels (TB-500/TB4 mix, Melanotan I, Klow, multi-INN blends) stay unmapped in Postgres.

## Database (Postgres)

Defined in `supabase/migrations/` (0001–0031 in Git; **live `cartwise-prod` is 0001–0030 plus MCP `research_operations` / `20260829082116` = 0031 SQL**). `0030_research_source_study_review_intake.sql` is applied. Hand-mirrored in `src/types/database.ts`.

**Auth-adjacent:** `profiles`, `user_roles` (`user` \| `admin`).

**Catalog:** `products`, `product_price_history`. Selling prices for the current user come from RPCs (`list_shop_products`), not a raw table select of list prices. `bulk_price_usd` is a per-unit tier price except when it is greater than `price_usd` with `bulk_price_min_quantity > 1` (Injectable Oils pack totals); `catalog_bulk_unit_price` / `getEffectiveUnitPrice` convert that to a unit price before quantity multiplication. Kit share pricing uses separate functions and does not share this conversion. Role markup is applied after that unit (`sell_unit_price`). Admin surcharge reporting stores the pre-markup unit vs selling line at checkout (`order_role_surcharge_lines`); it does not recompute from the current role.

**Cart:** `carts`, `cart_items` (version/optimistic lock, `price_tier` bulk/normal). View `cart_summaries`.

**Orders:** `orders` (telegram username + Lieferart + address snapshots from checkout; `0042`/`0045`), `order_items`, `order_status_history`, `order_admin_notes`. Status workflow (`0047`): pending, processing, dispatched, received, shipped, completed; historical confirmed/cancelled remain valid. Visual delivery progress is `order_progress` (`0049`/`0050`): one row per order (`status_key`, `progress_percent`, `comment`, `title`); customers read only their own order; upserts go through admin-only `upsert_order_progress`. Admin Übersicht writes seven fixed customer-facing statuses from `SHIPPING_PROGRESS_STATUSES` and does not change `orders.status`. Shipment tracking columns on `orders` (`tracking_number`, `tracking_carrier`, `tracking_url`, assignment + notification timestamps) are written only via admin-only `upsert_order_tracking`. Shipping cost fields (China/DE) from 0020+ live on `/admin/shipping-costs`. Admin order management is `/admin/orders` (Übersicht) plus `/admin/orders/:id`; legacy `/admin/shipping` redirects there. `create_order` validates payment, Lieferart, and the matching address fields server-side. Admin Bestell Zusammenfassung aggregates processing `order_items` by SKU. Quantity labels for shop, cart, orders, and PDF come from `src/lib/quantityFormat.ts` (Kit/Kits, Vial/Vials, Packung/Packungen; kit fractions only with a real `kit_share` identity).

**Customers:** `customer_roles`, `user_customer_roles`.

**Other:** `product_favorites`, `order_templates`, `order_template_items`, `exchange_rates`, `pdf_imports`, `pdf_import_rows`, `audit_logs`.

**Kit sharing (invite) + Kit Gesuche (marketplace):** both use `kit_shares` / `kit_share_participants`. Invite kits keep `is_open_request = false` (RLS: creator or participant). Direct SELECT policies use `user_participates_in_kit_share` (SECURITY DEFINER, same membership as before) so participant policies do not recurse on `kit_share_participants`; admin SELECT policies are unchanged (`0048`). Open marketplace kits (`is_open_request = true`) are listed via SECURITY DEFINER RPCs (`list_open_kit_requests`, `join_kit_request`, …). Join locks the kit row (`FOR UPDATE`) so remaining vials cannot be overbooked. Cart lines are created only when an open request becomes `full`, through the existing `kit_share_sync_*` helpers and `profiles.username` cart names. The Kit Gesuche product filter is scoped by shop category so BPC never appears under Reconstitution Water. See `docs/KIT_REQUESTS.md`.

**Research identity (Phase 1, 0024):** `substances`, `substance_aliases`, `substance_components`, `product_substances`. RLS: authenticated SELECT; admin write via `has_role`. Shop `products` columns were not altered.

**Research science (Phase 2, 0025):** `research_runs`, `research_run_sources`, `sources`, `source_substances`, `studies`, `study_substances`, `study_sources`. Imported from `published.json` (not raw cache). **0030 (live):** `sources.review_status` / `studies.review_status` (workflow, distinct from lifecycle / CT.gov status; new-row default `review-required`, existing backfilled `approved`), optional `connector` / `intervention` / `condition`, non-admin SELECT limited to approved rows, junction SELECT follows parent approval. Batch 03 import is a separate idempotent persist/SQL path: **104** sources + **36** studies `review-required` on production (`docs/RESEARCH_PRODUCTION_MIGRATION_0030.md`). **0031 (live as `research_operations`):** `0031_research_operations.sql` — run status `partial` / `queued` / `cancelled`, `trigger_kind`, scopes, statistics, retrieval logs, one-active-full-run index, `research_connector_health`, `community_reports` (empty, review-required default). Cron stays disabled. `docs/RESEARCH_FINAL_OPERATIONS_QA.md`.

**Research claims (Phase 3, 0026):** `claims`, `claim_sources`, `evidence_assessments`. Cited blocks from `published.json` (one claim per slot/item; summary paragraphs not split). A–F lives on assessments, not on `claims`.

**Research regulatory + review (Phase 4, 0027):** `regulatory_records`, `regulatory_history`, `review_actions`. Imported from published regulatory sources (41 records). Empty FDA/EMA search is never `not_approved`. Community remains unpublished as SQL. Dual-read: `VITE_RESEARCH_DB_MODE` (`postgres` default after Phase 11; `dual` compares; `legacy` emergency public rollback). Live apply **done** (0024–0029). Public lexicon (local + production) reads Postgres; files remain exclusive fallback. Phase 7: `docs/RESEARCH_DUAL_READ_PHASE_7.md`. Phase 11: `docs/RESEARCH_PUBLIC_LEXICON_CUTOVER_PHASE_11.md`. Phase 11C deploy: `docs/RESEARCH_PRODUCTION_LEXICON_CUTOVER_PHASE_11C.md`. **0028** tightens evidence SELECT. **0029** explicit `product_substances` manuals.

## Peptide / research data models

### SUBSTANCE (`PeptideSubstance` + overlay)

Identity fields live in `catalog.ts` (always start at evidence F / regulatory insufficient). Public Postgres mapping uses approved humanEvidence assessments for A–F; otherwise F. `applyPublishedProfile` still builds the **legacy fallback** catalog.

### PRODUCT (shop)

Postgres `products` (one row per SKU; no `product_variants` table). Customer-facing kit/pack labels come from `formatProductVariant()` in `src/lib/shop/variantCoverage.ts` (peptides: `10x 5 mg Vials`; orals: `5 mg × 100 Tabletten`). Shop grouping is by family slug except orals, which group by stored name so lexicon aliases do not merge distinct SKUs. Lexicon only stores `PeptideProductRef` (code, name, strength label, slug, blend flag) derived at runtime from shop rows — still without prices in the UI.

### SOURCE (`ProfileSource` / `PeptideSource`)

Curated in `published.json`: title, URL, publisher, dates, DOI, PMID, NCT, `sourceType`, `sourceQuality` 1–5, `accessDate`. Search-count rows are `scientific` (not primary trials). Community types: blog, reddit, forum, community.

Approved-label profiles store `regulatoryRegions` (e.g. US, EU). Audit findings that are not auto-resolved stay in `published.json` `reviewItems` (lexicon overlay) and in Postgres `review_actions` / review-required rows. **Admin Research** reads Postgres; `reviewItems` are labeled legacy fallback only. Batch 02 compile applies title/sponsor filters (`keepStudy` / `keepArticle`) so noisy CT.gov/PubMed hits are not published. Shop blends (`glow-blend`) compile as mapping-only profiles, not unique INNs.

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

Type exists (`CommunityReport`). Live `community_reports` after 0031 (empty). **No community rows imported.** UI shows Scientific Research vs Community Experience; Reddit/BfArM/MHRA/NMPA unavailable. Community cannot raise evidence.

### RESEARCH_UPDATE

Type + `createResearchDraft` / `canPublish` in `src/research/engine.ts`. There is **no** `research_updates` table. Admin Research shows Research Updates = 0 and does not invent rows.

### Relationships (logical)

```
Product.code ──client prefix/name──► Substance.slug (catalog.ts)
Product.id   ──product_substances──► substances.id (Postgres, Phase 1)
Substance ──n:n──► Source          (Postgres source_substances; public lexicon maps approved/sourced only)
Substance ──n:n──► Study (NCT)     (Postgres study_substances; Hudson NCTs excluded publicly)
Study ──n:n──► Source              (study_sources)
Substance ──1:n──► Claim            (Postgres claims; public: approved + source)
Claim ──n:n──► Source               (claim_sources)
Claim ──1:1──► EvidenceAssessment   (A–F not on the claim row; public: approved only)
Substance ──1:n──► RegulatoryRecord (region + product; public: current + approved)
RegulatoryRecord ──1:n──► RegulatoryHistory
ReviewAction ──admin──► claim | evidence | regulatory | research_update | substance | source | study
Substance ──1:n──► CommunityReport (none published)
Community ─x─► EvidenceLevel   (forbidden; communityCannotRaiseEvidence)
```

## Connector architecture

`ResearchConnector` in `src/research/connectors/types.ts`.

Scientific (browser stubs): FDA, EMA, BfArM, MHRA, NMPA, ClinicalTrials.gov, PubMed, literature.

Community stubs: Reddit, forum, blog.

Update Engine (`src/lib/peptide/research/updateEngine/`): injectable scientific adapters for PubMed, CT.gov, FDA, EMA. BfArM / MHRA / NMPA and community kinds stay `unavailable`. Connectors never auto-approve. Empty FDA search is not `not_approved`. EMA 404 is not evidence. Hudson NCTs are excluded. See `docs/RESEARCH_UPDATE_ENGINE_BLOCK_2.md`.

Research Operations (`src/lib/peptide/research/operations/`): persisted runs, Admin Update All, cancel/retry, concurrency, connector health, community table architecture. Live 0031 persist. UNCHANGED/DUPLICATE preserve `review_status`; UPDATED scientific fields demote to review-required with stored diff. See `docs/RESEARCH_FINAL_HARDENING.md`.

Node (not bundled as live client calls): `scripts/fetch-research-sources.mjs` (`batch01` / `batch02` / `batch03` / `all`), `scripts/fetch-regulatory-labels.mjs`, `scripts/fetch-regulatory-batch-03.mjs`, `scripts/compile-research-profiles.mjs` + `scripts/research-batch-02-curated.mjs` + `scripts/research-batch-03-analyze.mjs`.

## Caching

- Shop/orders: React Query `staleTime` 30s
- Exchange rate: DB + edge function
- Public lexicon: React Query `staleTime` 30s (`QUERY_KEYS.publicLexicon`); exclusive file fallback stays in the bundle
- Research compile cache: `src/research/cache/fetched/` + compiled `published.json` (legacy fallback, not mixed into a Postgres response)

## Security notes

- No service_role in `src/`
- External HTML is not injected from connector payloads; public lexicon text is mapped from approved Postgres claims or exclusive curated JSON fallback
- JSON-LD on lexicon detail is `WebPage` only (no fake ratings)

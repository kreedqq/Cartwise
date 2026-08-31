# PROJECT STATE

**Code is the source of truth.** If this file disagrees with `src/`, update this file.

Last documentation pass: **2026-09-01** (Kit Gesuche marketplace applied to production).

**Update 2026-09-01 (Kit Gesuche production)**: Open kit marketplace at `/kit-gesuche`. Additive migration `0041_kit_requests.sql` applied to `cartwise-prod` (`is_open_request` default false; all existing invite kits remain false). Join is an atomic RPC with `FOR UPDATE`. Cart sync reuses existing kit-share helpers and only runs when the request is full. Invite kit sharing, 10er rule, markup, and `profiles.username` cart names are unchanged.

**Update 2026-08-31 (privacy)**: Developer-identifying test fixtures and local Windows account paths in docs/scripts were replaced with generic placeholders (`Test User`, `testuser`, `ExampleUser`, `C:\Users\<USERNAME>\...`, `os.homedir()`). Username/kit/shop/pricing logic unchanged. No production DB writes.

**Update 2026-08-31 (later)**: Canonical `profiles.username` is shown in Topbar/Dashboard/Profile; new carts are named after the username; kit-share auto-create uses the same name (migration `0040`). Redundant shop `ab 10` badge removed. No price/SKU/kit-pricing changes.

**Update 2026-08-31**: Orals pack labels are formatted from existing `products.dosage_vial` via `formatProductVariant()` (no DB/SKU/price writes). Oral shop grouping no longer merges lexicon aliases (`BPC` ≠ `BPC157`). Five active SKUs remain `price_usd = 0` (BLOCKER: import source and price history are also 0; Excel file missing).

**Update 2026-08-30**: migration `0039_fix_kit_share_partial_order_completion.sql` deployed to `cartwise-prod` (local = remote through `0039`, verified via `supabase migration list`). Fixes the kit-share `create_order` bug where the whole kit flipped to `'ordered'` after the first participant ordered, blocking everyone else; adds `kit_share_participants.ordered_at`/`.order_id`; Dashboard now hides ordered carts (`isOpenCart` filter); `OrderDetail.tsx` now shows `payment_method`. See `docs/CHANGELOG.md` for the full entry.

## Identity

| | |
|---|---|
| Visible product name | Peptix (`APP_NAME` / `BRAND_NAME` in `src/lib/constants.ts`) |
| npm package name | `shared-cart-app` |
| Goal | B2B ordering platform (catalog, carts, selling prices, orders) plus an independent scientific **Peptid Rechner & Lexikon** area |
| UI language | German |
| Default theme | Dark (`index.html` `class="dark"`) |

## Git / backup (working copy)

| | |
|---|---|
| Branch | `main` (tracks `origin/main`) |
| Last backup commit | `feat: finalize research platform` (this finalization; not pushed) |
| Last documentation pass | Finalization 2026-08-29; **FINAL_RELEASE_READY_WITH_LIMITATIONS** until live JWT retest; backup `PEPTIX-FULL-BACKUP-FINAL-2026-08-29-1143` |
| Full local backup | `PEPTIX-FULL-BACKUP-2026-08-29-1054` plus dump `PEPTIX-PRODUCTION-FINAL-2026-08-29-1130.sql` under `Documents\PEPTIX-BACKUPS\` |
| Nested copy | A nested `Cartwise/` tree may exist; do not treat it as the app source. Tests are scoped to `src/` (`vite.config.ts`). |

Do not commit unless the user asks. Recommended backup commit (when requested): all intended app files **except** `.env*`, credentials, and nested gitlinks.

## Current development status

The app is a React SPA on Vite with Supabase Auth + Postgres (RLS) + RPCs. Storefront, carts, checkout/orders, Discord OAuth, and admin catalog tools are implemented in code. Peptide hub/calculator are unchanged. Public lexicon is Postgres-primary with exclusive file fallback. Dual mode compares only and never mixes. Persist: UNCHANGED/DUPLICATE preserve `review_status`; NEW and scientific UPDATED go to review-required. Public profile splits Claim Sources and Source References. Live DB **0031**, inventory **27 / 616 / 154 / 294 / 294 / 41 / 21 / 93**. Shop 320 / 0 orders / fp `afd9f04bbf360fb5944709f30d653973`. Auth 2 / fp `76af77941b50c8bc6ff620fc81e9ac50`. RLS **RLS_VERIFIED_WITH_JWT_LIMITATION**. Batch 04 is **not** started. Final local backup: `Documents\PEPTIX-BACKUPS\PEPTIX-FULL-BACKUP-FINAL-2026-08-29-1143`.

Peptide routes sit behind `ProtectedRoute` (same login as shop).

## Implemented features (from code)

### Auth / login

- Email/password login and register, magic link, forgot/reset password
- OAuth: **Discord only** (`OAUTH_PROVIDERS = ["discord"]`)
- `skipBrowserRedirect: true` plus strip `skip_http_redirect` so GoTrue JSON is not saved as `authorize.json`
- OAuth success path `/shop`; other post-login `/dashboard`
- Auth layout uses `/peptix-brand.jpg`
- New users: `user` role via `handle_new_user`; customer role assignment is server-side (not self-serve admin)

### Navigation (logged-in `AppShell`)

Sidebar: Übersicht `/dashboard`, Shop `/shop`, **Kit Gesuche** `/kit-gesuche`, **Lexikon & Rechner** `/peptide`, Bestellungen `/orders`, Profil `/profile`, Admin `/admin` (admins).

Mobile: same set plus Favorites in `MAIN_NAV_ITEMS`; peptide label **Lexikon & Rechner**; Kit Gesuche short label **Kits** on the bottom bar.

Admin nav: Übersicht, Bestellungen, Rollen & Preisregeln, Versandkosten, Produkte, Produktimport, Import-Historie, Benutzer, Audit-Log, Research.

### Routes (`src/App.tsx`)

Public: `/login`, `/auth/callback`, `/register`, `/forgot-password`, `/reset-password`, `/403`.

Protected: `/shop`, `/kit-gesuche`, `/favorites`, `/dashboard`, `/carts/:cartId`, `/carts/:cartId/checkout`, `/orders`, `/orders/:orderId`, `/profile`, `/peptide`, `/peptide/rechner`, `/peptide/lexikon`, `/peptide/lexikon/:slug`.

Admin: `/admin`, `/admin/orders`, `/admin/orders/:orderId`, `/admin/roles`, `/admin/shipping`, `/admin/products`, `/admin/pdf-import`, `/admin/import-history`, `/admin/users`, `/admin/audit-log`, `/admin/research`.

`/` → `/dashboard`. Unknown → `NotFound`.

### Shop

- Four storefront groups: Peptides, Injectable Oils, Orals, Reconstitution Water (BAC/AA Water mapped together; codes AA10, BA03, BA10)
- Selling prices via RPC `list_shop_products` / `get_shop_product_by_code` (markup server-side)
- Favorites, quick order, order templates
- No lexicon prices or cart buttons on peptide pages

### Carts / orders

- Carts with items, bulk tier, duplicate warnings, paste import, price updates
- Checkout creates orders (`create_order` RPC)
- Statuses: pending, processing, confirmed, completed, cancelled
- Shipping: China + DE amounts; admin shipping tools
- Ordered carts locked (migration 0023)
- Admin can delete orders (`delete_order`)

### Peptid Rechner

- Tabs: Rekonstitution, Konzentration, Einheiten, Vial
- Units: g, mg, mcg, ng, ml
- IU: **no invented conversion** (`iuConversionUnavailable`)
- Output framed as mathematical result, not a medical dose
- Optional query `vialMg` / `name` from lexicon (“Im Rechner verwenden” copies strength only)

### Peptid Lexikon

- Search (name, alias, development name, CAS, slug)
- Category + status filters
- Identity catalog: 27 substances in `PEPTIDE_SUBSTANCES_IDENTITY` (identity defaults remain F until overlay)
- **Public read (local + production):** Postgres via `usePublicLexicon` / `resolvePublicLexicon`. Files (`catalog.ts` + `published.json`) remain exclusive fallback. See `docs/RESEARCH_PUBLIC_LEXICON_CUTOVER_PHASE_11.md` and `docs/RESEARCH_PRODUCTION_LEXICON_CUTOVER_PHASE_11C.md`.
- Public science: approved + sourced claims; approved evidence overlays only (267 review-required hidden); current approved regulatory with region; Hudson NCTs excluded
- TB-500 ≠ Thymosin Beta-4; fictional/Hudson CT.gov records are not published as studies
- Glow-blend is a product blend (not a unique INN); Melanotan II ≠ afamelanotide; IGF-1 LR3 ≠ mecasermin
- `regulatoryRegions` from current approved Postgres records (US / EU as sourced)
- Community block: anecdotal disclaimer; Reddit connector returns unavailable
- Shop SKUs mapped by code prefix/name (`src/lib/peptide/search.ts` / `substanceSlugForProduct`); no prices in UI
- Parallel Postgres mapping: `product_substances` (0024 prefix/glow + 0029 explicit manuals). Client mapper is legacy fallback and is **not** removed. Intended SoT after apply: explicit Postgres rows.

### Research system

- Connector interface: `search`, `getSource`, `getUpdates`, `normalize`, `validate`, `healthCheck`
- Browser connectors all `healthCheck` → `unavailable` (no live keys in client); NMPA stub added as unavailable
- Official API **batch** via Node scripts: ClinicalTrials.gov v2, NCBI E-utilities, openFDA, PubChem, EMA EPAR HTTP check
- Raw cache: `src/research/cache/fetched/`
- Compile: `npm run research:compile` → published profiles
- Engine: drafts do not auto-publish (`canPublish` requires review + approved)
- **Update Engine (Block 2):** `src/lib/peptide/research/updateEngine/` — PubMed / CT.gov / FDA / EMA normalizers, identity matching, Hudson exclusion, change detection, scoped runs, partial status, rate-limit retry, review-required persist plan (`productionWrite: false`). Cron off. Community layer unavailable. `docs/RESEARCH_UPDATE_ENGINE_BLOCK_2.md`
- **Research Operations (Block 3–4):** `src/lib/peptide/research/operations/` — persisted runs, review-candidate store, cancel/retry, full-run concurrency, connector health, Admin Update All. After 0031, runs persist to Postgres; session store is fallback. Cache-backed connectors (no live client HTTP). `docs/RESEARCH_OPERATIONS_BLOCK_3.md`, `docs/RESEARCH_FINAL_OPERATIONS_QA.md`
- Live `0031_research_operations.sql` is applied on cartwise-prod as MCP `research_operations` (`20260829082116`). Cron off. No community data imported.
- Admin `/admin/research`: Postgres dashboard + review queue + Research Operations panel. Public lexicon does not expose `review_actions`.

### Admin (shop)

Products, CSV/XLSX/PDF import, import history, users, audit log, customer roles & selling-price rules, shipping, orders.

### Database (Postgres / Supabase)

Migrations `0001`–`0031` under `supabase/migrations/` (Git). Types: `src/types/database.ts`.

**Live `cartwise-prod`:** applied `0001`–`0030` plus MCP `research_operations` (`20260829082116` = 0031 SQL). Research tables from 0024–0031 are **on** the deployed database. Shop product fingerprint unchanged vs pre-0031. Block 4 did **not** deploy a new SPA.

Shop tables unchanged. Research identity (0024): `substances`, `substance_aliases`, `substance_components`, `product_substances`. Research science (0025): `research_runs`, `research_run_sources`, `sources`, `source_substances`, `studies`, `study_substances`, `study_sources`. Research claims (0026): `claims`, `claim_sources`, `evidence_assessments`. Research regulatory/review (0027): `regulatory_records`, `regulatory_history`, `review_actions`. **0028** replaces evidence SELECT (admin all; non-admin approved assessments only). **0029** explicit product mappings + unmap MT1/KL80. **0030** source/study review_status + Batch 03 intake. **0031** durable run columns, `research_connector_health`, `community_reports` (empty). Public lexicon (local + production) reads Postgres with exclusive file fallback. Fixes: `docs/RESEARCH_PRODUCTION_FIXES.md`. `docs/RESEARCH_FINAL_OPERATIONS_QA.md`.

Edge functions in repo: `get-exchange-rate`, `set-user-role`.

### Environment variables (names only)

Required in client (`.env.example`):

- `VITE_SUPABASE_URL` — required
- `VITE_SUPABASE_ANON_KEY` — required (anon / publishable; never service_role in `src/`)

Optional build:

- `VITE_BASE_PATH` — Vite `base` (GitHub Pages workflow)
- `VITE_RESEARCH_DB_MODE` — optional; `postgres` (default, Phase 11), `dual`, or `legacy` (emergency public-lexicon rollback). Dual keeps admin comparison. Public lexicon never mixes Postgres fields with `published.json` on one request.

Not in the frontend; optional for later server-side research (names only):

- `PUBMED_API_KEY` — optional (NCBI E-utilities works without; higher limits with key)
- Reddit official API credentials — **not configured**; connector stays unavailable

### Tests / quality (last local run 2026-08-29, Block 3)

| Gate | Script | Last result |
|---|---|---|
| Tests | `npm test` | 478 passed / 39 files |
| Typecheck | `npm run typecheck` | pass |
| Lint | `npm run lint` | 0 errors, 5 `react-refresh/only-export-components` warnings (existing UI/auth files) |
| Build | `npm run build` | pass; Vite warns main chunk > 500 kB; peptide `catalog` chunk ~348 kB kept for exclusive fallback |

### Known issues / gaps

- Peptide **community** architecture prepared in 0031 (`community_reports`); no rows imported; Reddit unavailable; community cannot raise evidence
- Public lexicon reads Postgres with exclusive legacy fallback (`docs/RESEARCH_PUBLIC_LEXICON_CUTOVER_PHASE_11.md`). Production SPA (`https://cartwise-zeta.vercel.app`) is `5e38cf1` / Phase 11C. Emergency rollback: `VITE_RESEARCH_DB_MODE=legacy`. Exclusive fallback is covered by unit tests; a live production outage was **not** demonstrated (Phase 12A). Dual Read / Admin Research copy is corrected in source, not yet deployed.
- Live `cartwise-prod` has **0024–0030 applied**. Phase 6C: **PRODUCTION_APPLY_SUCCESS** (`docs/RESEARCH_PRODUCTION_APPLY_0024_0029.md`). Phase 17: **PRODUCTION_0030_APPLY_SUCCESS_WITH_RLS_LIMITATION**.
- 0028 evidence SELECT is live; 0029 explicit product mappings are live (`product_substances` = 93)
- Phase 17: live **0030**; sources **516** / studies **154**; 104+36 Batch 03 review-required. `docs/RESEARCH_PRODUCTION_MIGRATION_0030.md`
- Client product mapper remains legacy fuzzy fallback; Postgres SoT is `product_substances` (prefix + explicit). Unresolved: BT*, MT1, Klow, multi-INN blends
- Oral Semaglutide DailyMed title vs NDA213051 and Ovitrelle-vs-urinary-hCG remain UNRESOLVED
- Admin Research reads Postgres (`docs/RESEARCH_ADMIN_POSTGRES_PHASE_8.md`). `research_updates` table does not exist.
- Phase 9 production browser QA: **BROWSER_QA_PASS_WITH_LIMITATIONS** (`docs/RESEARCH_PRODUCTION_BROWSER_QA_PHASE_9.md`). No admin session in the QA browser; hosted SPA is `https://cartwise-zeta.vercel.app` (predates uncommitted Phase 8 UI).
- Phase 9B deployment readiness: **DEPLOYMENT_READY** (`docs/RESEARCH_DEPLOYMENT_READINESS_PHASE_9B.md`). No commit/push/deploy in that audit.
- Phase 10B production deploy preflight: **DEPLOYMENT_PREFLIGHT_PASS** (`docs/RESEARCH_DEPLOYMENT_PREFLIGHT_PHASE_10B.md`). SPA-only; do not re-apply 0024–0029. Not pushed/deployed.
- Phase 10C production SPA deploy: **PRODUCTION_DEPLOY_SUCCESS_WITH_QA_LIMITATION** (`docs/RESEARCH_PRODUCTION_DEPLOY_PHASE_10C.md`). `https://cartwise-zeta.vercel.app` serves `baaa335`/`a21e838`. DB still 0029.
- Logged-in production admin browser QA (2026-08-29): **BROWSER_QA_NOT_READY** (`docs/RESEARCH_PRODUCTION_ADMIN_BROWSER_QA.md`). Admin Research/Postgres counts, mapping, lexicon **list**/search, shop, and cart pass. **Lexicon detail and `/peptide/rechner` crash** on the **currently deployed** SPA (`Button asChild` + Radix Slot / `button-C9NJmCLl.js`).
- Phase 10D local fix: **UI_CRASH_FIXED** (`docs/RESEARCH_UI_CRASH_FIX_PHASE_10D.md`).
- Phase 10E: **UI_FIX_DEPLOYED_AND_VERIFIED** (`docs/RESEARCH_UI_CRASH_FIX_DEPLOY_PHASE_10E.md`). Local commit `b079bbf` (`fix: resolve asChild button slot crash`), not pushed. Production `https://cartwise-zeta.vercel.app` serves `button-Dq-9OMxe.js`. Lexicon detail + calculator no longer crash. DB still 0029.
- Phase 11C: **PRODUCTION_LEXICON_CUTOVER_SUCCESS_WITH_LIMITATIONS** (`docs/RESEARCH_PRODUCTION_LEXICON_CUTOVER_PHASE_11C.md`). Phase 12: **PRODUCTION_POST_CUTOVER_PASS_WITH_LIMITATIONS** (`docs/RESEARCH_PRODUCTION_POST_CUTOVER_AUDIT.md`). Production alias `https://cartwise-zeta.vercel.app`. DB still 0029. Docs not committed.
- Browser research connectors are stubs; live fetch is Node scripts only. Block 3 Admin Update All uses official cache adapters, not live HTTP.
- Reddit / forums / blogs / user-report: unavailable (by design without official API); community cannot raise evidence
- BfArM / MHRA / NMPA not queried (unavailable connectors)
- Numeric PK values not copied from labels (no unsourced numbers)
- Excel `GENXELL_Warenkorb_8_Kunden_FINAL(1).xlsx` is **not** in the repository
- GLP-1 CT.gov 12-cap lists can include class-adjacent trials; claims do not treat them as approved indications
- Open Batch 01 review items: Mazdutide NMPA primary source, Orforglipron EMA, Hudson cluster, GHK X39
- Batch 02 leftovers: exclusive Partial = IGF-1 LR3; exclusive Review Required = thymosin-alpha-1 and gonadorelin (`reviewStatus` is a separate flag, not a second inventory count)
- Batch 03: **RESEARCH_BATCH_03_COMPLETE_WITH_REVIEW**. Phase 17 imported **104** sources + **36** studies as review-required on production (`docs/RESEARCH_PRODUCTION_MIGRATION_0030.md`). Hudson excluded. Tesamorelin EMA Egrifta is a 2012 withdrawn MAA, not EU approval.
- `package.json` name still `shared-cart-app`

### Current priority

1. Keep shop/auth stable. **Do not push** unless asked.
2. Finalization commit is `feat: finalize research platform`. Deploy that SPA only. Do not start Batch 04, cron, auto-approve, or production SQL.
3. RLS remains **RLS_VERIFIED_WITH_JWT_LIMITATION**.
4. Optional: review 204 review-required sources.

### Architecture decisions (in force)

- Shop and lexicon are separate URL trees and data models.
- Product (SKU, price) ≠ Substance (science).
- TB-500 is not merged with Thymosin Beta-4.
- Community cannot raise evidence.
- No FDA hit ≠ “not approved”; use not-found / insufficient / investigational / clinical-development as sourced.
- Research updates start as draft; published batch was curated after official API fetch.
- No Reddit scraping.
- No invented scientific identifiers.

### User requirements (known)

Independent peptide area outside shop; calculator; lexicon; scientific / trial / regulatory sources; community as anecdotal only; evidence levels; admin research queue; product↔substance mapping without prices in the lexicon.

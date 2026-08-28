# PROJECT STATE

**Code is the source of truth.** If this file disagrees with `src/`, update this file.

Last documentation pass: **2026-08-28** (Research Batch 01 quality audit).

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
| Last backup commit | `0da9c90` — *chore: backup current peptide platform state* |
| Last documentation pass | Research Batch 01 quality audit (2026-08-28); audit corrections may be uncommitted vs that backup |
| Nested copy | A nested `Cartwise/` tree may exist; do not treat it as the app source. Tests are scoped to `src/` (`vite.config.ts`). |

Do not commit unless the user asks. Recommended backup commit (when requested): all intended app files **except** `.env*`, credentials, and nested gitlinks.

## Current development status

The app is a React SPA on Vite with Supabase Auth + Postgres (RLS) + RPCs. Storefront, carts, checkout/orders, Discord OAuth, and admin catalog tools are implemented in code. Peptide hub/calculator/lexicon and a curated research batch (15 substances) are implemented **in the client** (TypeScript catalog + `published.json`), not as Postgres tables.

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

Sidebar: Übersicht `/dashboard`, Shop `/shop`, Rechner & Lexikon `/peptide`, Bestellungen `/orders`, Profil `/profile`, Admin `/admin` (admins).

Mobile: same set; peptide label **Lexikon**.

Admin nav: Übersicht, Bestellungen, Rollen & Preisregeln, Versandkosten, Produkte, Produktimport, Import-Historie, Benutzer, Audit-Log, Research.

### Routes (`src/App.tsx`)

Public: `/login`, `/auth/callback`, `/register`, `/forgot-password`, `/reset-password`, `/403`.

Protected: `/shop`, `/favorites`, `/dashboard`, `/carts/:cartId`, `/carts/:cartId/checkout`, `/orders`, `/orders/:orderId`, `/profile`, `/peptide`, `/peptide/rechner`, `/peptide/lexikon`, `/peptide/lexikon/:slug`.

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

- Search (name, alias, development name, category)
- Category + status filters
- Identity catalog: 27 substances in `PEPTIDE_SUBSTANCES_IDENTITY`
- Published research overlay for **15** slugs via `src/lib/peptide/profiles/published.json` (access date 2026-08-28; quality-audited 2026-08-28)
- Remaining identity-only profiles stay evidence **F** / regulatory **insufficient** until sourced
- TB-500 ≠ Thymosin Beta-4; fictional CT.gov NCT07487363 is not published as a study
- `regulatoryRegions` stored for approved-label products (US / EU as sourced)
- Community block: anecdotal disclaimer; Reddit connector returns unavailable
- Shop SKUs mapped by code prefix/name (`src/lib/peptide/mapping.ts`); no prices in UI

### Research system

- Connector interface: `search`, `getSource`, `getUpdates`, `normalize`, `validate`, `healthCheck`
- Browser connectors all `healthCheck` → `unavailable` (no live keys in client)
- Official API **batch** via Node scripts: ClinicalTrials.gov v2, NCBI E-utilities, openFDA, PubChem, EMA EPAR HTTP check
- Raw cache: `src/research/cache/fetched/`
- Compile: `npm run research:compile` → published profiles
- Engine: drafts do not auto-publish (`canPublish` requires review + approved)
- Admin `/admin/research`: connector table (client unavailable), curated research reports, published **reviewItems** queue

### Admin (shop)

Products, CSV/XLSX/PDF import, import history, users, audit log, customer roles & selling-price rules, shipping, orders.

### Database (Postgres / Supabase)

Migrations `0001`–`0023` under `supabase/migrations/`. Types: `src/types/database.ts`.

Shop tables exist. **No** `substances` / `sources` / `studies` SQL tables yet — peptide research is file-based.

Edge functions in repo: `get-exchange-rate`, `set-user-role`.

### Environment variables (names only)

Required in client (`.env.example`):

- `VITE_SUPABASE_URL` — required
- `VITE_SUPABASE_ANON_KEY` — required (anon / publishable; never service_role in `src/`)

Optional build:

- `VITE_BASE_PATH` — Vite `base` (GitHub Pages workflow)

Not in the frontend; optional for later server-side research (names only):

- `PUBMED_API_KEY` — optional (NCBI E-utilities works without; higher limits with key)
- Reddit official API credentials — **not configured**; connector stays unavailable

### Tests / quality (last local run 2026-08-28)

| Gate | Script | Last result |
|---|---|---|
| Tests | `npm test` | 280 passed / 23 files |
| Typecheck | `npm run typecheck` | pass |
| Lint | `npm run lint` | 0 errors, 5 `react-refresh/only-export-components` warnings (existing UI/auth files) |
| Build | `npm run build` | pass; Vite warns main chunk > 500 kB; peptide catalog chunk includes `published.json` |

### Known issues / gaps

- Peptide research not persisted in Postgres; no RLS for sources
- Browser research connectors are stubs; live fetch is Node scripts only
- Reddit / forums / blogs: unavailable (by design without official API)
- BfArM / MHRA not queried
- Numeric PK values not copied from labels (no unsourced numbers)
- Excel `GENXELL_Warenkorb_8_Kunden_FINAL(1).xlsx` is **not** in the repository
- GLP-1 CT.gov 12-cap lists can include class-adjacent trials; claims do not treat them as approved indications
- Open Batch 01 review items: Mazdutide NMPA primary source, Orforglipron EMA, Hudson cluster, GHK X39
- Identity-only leftover: Semax, Selank, Thymosin Alpha-1, KPV, IGF-1 LR3, Somatropin, HCG, Gonadorelin, Melanotan II, glow-blend (blend identity only)
- `package.json` name still `shared-cart-app`

### Current priority

1. Keep shop/auth stable.
2. Do **not** start Research Batch 02 until asked.
3. Optional: persist research models in Supabase after review workflow.
4. Optional: resolve Batch 01 Review Required items (NMPA primary, EMA FOUNDAYO).

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

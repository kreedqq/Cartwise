# Changelog

Only material changes. Dates are local project days.

## 2026-08-31 (personal data / privacy cleanup)

### Changed

- Replaced developer-identifying test fixtures and example handles with generic `Test User` / `testuser` / `ExampleUser`.
- Replaced local Windows account paths in docs and scripts with `<USERNAME>` placeholders or `os.homedir()`.
- Username, kit sharing, pricing, RLS, and product data are unchanged. No production database writes. No commit/push/deploy in this pass.

## 2026-08-31 (fix: unify usernames and clean up quantity pricing UI)

### Fixed

- **Username**: Topbar, Dashboard greeting, and Profile now show `profiles.username`. Email prefixes and `display_name` are no longer used as a public handle. Kit sharing already returned username via `list_kit_share_members` / `get_my_kit_share`.
- **Cart names**: New carts (Create dialog, first shop add, kit-share auto-create) use the username. Open `Warenkorb` / previous-username draft carts are renamed on `set_username`. Ordered carts are not rewritten.
- **Bulk UI**: Removed the redundant `ab 10` line next to the bulk price. Column/card label remains `Preis ab 10 Stück`; remaining-to-bulk copy is unchanged. Pricing math is unchanged.

## 2026-08-31 (orals variant display + shop 0-price audit)

### Fixed

- **Root cause**: Orals already stored pack size in `products.dosage_vial` (e.g. `50mg x 25tablets`). `formatVialVariant()` only formatted peptide kits (`10x 5 mg Vials`) and oil strength, so shop/cart/checkout/orders dropped the pack unit. There is no `product_variants` table; each SKU is a `products` row grouped by name.
- Extended `formatVialVariant` / `formatProductVariant` with `formatOralVariantLabel()`: `5 mg × 100 Tabletten`, `50 mg × 60 Kapseln`, `20 mg × 25 Stück`, B12 `10 ml × 1 mg/ml × 1 Flasche`. Source unit vocabulary is preserved; missing packs are not invented (`HHB`/`GGH` stay `Blend`).
- Shop cards: oral titles are name-only; pack is a standalone line or the existing variant dropdown. Cart, checkout, order detail, admin order, and PDF/CSV export use the same formatter (SKU coverage fallback when cart lines have no `dosage_vial`).
- Oral grouping uses the stored name so lexicon aliases do not merge distinct SKUs (`BPC` vs `BPC157`). Peptide family grouping is unchanged.
- Zero-price audit (final): 5 active SKUs have stored `price_usd = 0` with a non-zero bulk price (`B1201`, `B1210`, `GGH`, `HHB`, `SHB`). Source is `GENXELL_IMPORT_FINAL.csv` (create + update 2026-08-27, quality warning “Mengenpreis ist höher als der Normalpreis”). `product_price_history` never had a non-zero unit price (`old_price_usd` null → `0`). `GENXELL_Warenkorb_Final.xlsm` is not on disk. Bulk was not copied to unit price.

### Tests

- `src/tests/oralVariants.test.ts` plus coverage in `variantCoverage.test.ts`, `cartDisplay.test.ts`, `shopDisplay.test.ts`.

## 2026-08-30 (fix: admin order views did not render payment_method)

### Fixed

- **Root cause**: `orders.payment_method` was already fetched correctly everywhere (`listAllOrders` uses `select("*")`; `getOrder`/`useOrder` — shared by the customer and admin order detail pages — already selects it via `CUSTOMER_ORDER_COLUMNS`). This was a pure UI omission: `AdminOrders.tsx` (list) and `AdminOrderDetail.tsx` never rendered the field anywhere, even though it was present on the fetched `order` object.
- Extracted the checkout payment-method glyph out of `PaymentMethodSelector.tsx` into a shared `src/components/orders/PaymentMethodIcon.tsx`, and added `src/components/orders/PaymentMethodBadge.tsx` (mirrors the existing `OrderStatusBadge` convention) that renders the real `order.payment_method` or, for older orders / unexpected values, a plain **"Nicht angegeben"** — never an invented value.
- Wired `PaymentMethodBadge` into `AdminOrderDetail.tsx` (next to the status badge in the header) and into a new "Zahlung" column in `AdminOrders.tsx`'s list table.
- No RPC, query, or database type change was needed — no migration required for this fix.
- New tests: `src/tests/adminPaymentMethod.test.tsx` (renders `PaymentMethodBadge` for all 3 methods + null + unknown value, plus source-level checks that both admin views actually use it).

## 2026-08-30 (fix: kit order lifecycle, payment persistence, cart lifecycle) — DEPLOYED TO PRODUCTION

### Fixed

- **Root cause of `P0001 "Ungültiger Kit-Anteil im Warenkorb."`**: `create_order` unconditionally set the whole `kit_shares.status = 'ordered'` as soon as any one participant submitted their order, permanently blocking every remaining participant (their own `create_order` call required `status = 'full'`). Migration `0039_fix_kit_share_partial_order_completion.sql`:
  - Adds `kit_share_participants.ordered_at` / `.order_id` (additive, nullable, no existing row touched) to track completion per participant.
  - `create_order` now allows a participant to order while the kit is `'full'` **or already `'ordered'`** (meaning someone else finished first), stamps only that participant's `ordered_at`/`order_id`, and promotes `kit_shares.status` to `'ordered'` only once every participant has ordered. Locks (`for update`) the kit row and the participant row to make this race-safe when two participants submit near-simultaneously.
  - `update_kit_share_quantity`, `update_kit_share_distribution`, `remove_kit_share_participant`, `leave_kit_share`, `cancel_kit_share` now reject changes to a participant who already ordered, and `cancel_kit_share` never deletes cart items belonging to an already-`'ordered'` cart.
  - `get_my_kit_share` now returns `hasOrdered` per participant and `myHasOrdered`, so `KitShareDialog` can disable quantity/removal controls for an already-placed order instead of only failing on submit.
- Dashboard "Warenkörbe" listed already-ordered carts forever; now filtered through the existing `isOpenCart` helper (`src/pages/Dashboard.tsx`).
- `orders.payment_method` was saved correctly but never rendered; `OrderDetail.tsx` now shows "Zahlungsmethode" in the order history card.

### Production rollout

- Verified locally against a real Postgres instance (`scripts/repro_kit_order_bug.sql`, rolled back) before touching production.
- `supabase db push --dry-run` confirmed only `0039` would apply; applied to `cartwise-prod` — purely additive (2 new nullable columns, function replacements), zero rows deleted, `orders`/`carts`/`kit_shares`/`kit_share_participants` row counts unchanged pre/post.
- Pre-existing production kit shares that were already stuck `'ordered'` from the old bug were intentionally **not** heuristically backfilled with `ordered_at`/`order_id` (ambiguous historical cart/order linkage on this data made a safe 1:1 match impossible) — confirmed this has no functional impact since kit-level `'ordered'` status already fully blocks edits, and cart-level idempotency (not participant-level) is what prevents duplicate orders.
- New regression suite `src/tests/kitOrderLifecycle.test.ts` guards the fix at the SQL/TSX source level; `src/tests/kitSharesService.test.ts` covers the new `hasOrdered`/`myHasOrdered` mapping.

## 2026-08-30 (kit sharing 3.0: username, participant removal, cart/checkout edit)

### Added

- Migration `0038_username_and_kit_participant_removal.sql`:
  - `profiles.username` — unique (case-insensitive), validated (`^[A-Za-z][A-Za-z0-9_.]{2,23}$`), nullable for a safe transition (additive, no existing row touched).
  - `username_available(text)` / `set_username(text)` RPCs — self-service, server-validated, server-unique.
  - `list_kit_share_members()` now returns `username` instead of `display_name` (real name is never shown to other users during kit sharing); only members who already claimed a username are selectable.
  - `get_my_kit_share` participants now show `username`, and the payload now includes `isCreator` (server-authoritative, avoids client guessing).
  - `remove_kit_share_participant(kit_share_id, participant_user_id)` — creator-only: deletes the participant, deletes their kit cart line, re-syncs remaining carts. Previously only self-`leave_kit_share` existed; the creator had no way to remove someone else (Phase 8 gap).
- `RequireUsernameDialog` — mounted in `AppShell`; prompts any authenticated user without a username once, on any page, pre-filling a sanitized OAuth-provided suggestion (Discord `user_name`/`full_name`) as a suggestion only, never auto-saved.
- Registration now requires a validated, unique username (`usernameSchema`, 3–24 chars) alongside email/password; claimed via `set_username` right after signup when a session is available immediately.
- `EditKitShareButton` + `KitShareDialog` "existing kit" mode (`existingKitShareId` prop, loads via `get_my_kit_share`) — "Kit-Aufteilung bearbeiten" is now reachable directly from Cart (desktop table + mobile list) and Checkout for any kit-share cart line, not only from the Shop's "Kit teilen" flow.
- `KitShareDialog`: creator can remove a participant inline (calls `remove_kit_share_participant`, re-syncs carts).

### Notes

- `create_order`'s existing kit validation (kit must be `full`, participant must exist, quantity must match the cart line exactly) already covered most of the checkout re-validation requirement; left untouched to avoid risking the working checkout path.
- `list_kit_share_members` keeps its historical `(id, display_name)` column shape for backward compatibility; the column is now sourced from `username`, not the real name.

## 2026-08-30 (kit share proportional pricing)

### Fixed

- Kit share catalog unit used the **full kit/bulk price** as the per-vial unit when allocation reached `bulk_min` (e.g. 6 vials × 100 USD = 600). Correct formula: `kit_catalog_total × participant_quantity / kit_size`, then role markup.
- Migrations `0036_fix_kit_share_catalog_unit_pricing.sql` and `0037_fix_kit_share_participant_pricing.sql`: pack-size-aware bulk, proportional participant base, cart unit = catalog unit (never full kit price).
- TypeScript mirror `src/lib/shop/kitSharePricing.ts` plus regression tests (6+4=100, 25% markup 75/50).

## 2026-08-30 (kit sharing 2.0)

### Added

- Migration `0035_kit_share_distribution_and_ten_rule.sql`: 10-unit kit rule, `update_kit_share_distribution` RPC, bulk-aware kit pricing, kit size multiples of 10 (10–100).
- `src/lib/shop/kitUnits.ts` — category-aware unit labels (Vials / Stück), kit size options.
- Kit dialog: kit size selector, **Verteilung bearbeiten** edit mode, all products shareable.

### Changed

- Kit sharing available for **all** shop products (not only x10vials coverage rows).
- Distribution changes sync all participant carts atomically via `kit_share_sync_all_participant_carts`.
- Creator receives participant `userId` in `get_my_kit_share` for distribution editing.
- Bulk tier applies when shared allocation reaches product bulk minimum (oils/orals).

## 2026-08-30 (kit sync / UX overhaul)

### Added

- Migration `0034_kit_share_cart_sync.sql` (production `kit_share_cart_sync`): server-side kit cart sync for all participants via `kit_share_sync_participant_cart`; wired into create/invite/update/leave/cancel/add_kit_share_to_cart RPCs.
- Central helpers: `src/lib/shop/priceLabels.ts`, `src/lib/shop/cartDisplay.ts`, `src/lib/navigation.ts` (`Lexikon & Rechner`).
- Tests: `priceLabels.test.ts`, `cartDisplay.test.ts`, `kitCartSync.test.ts`.

### Changed

- Kit sharing: participant cart lines sync automatically on invite/update (no manual add-to-cart).
- Shop: category-aware price column labels (peptides/water kit vs oils/orals unit).
- Cart UI: kit share badge/subtitle; visible delete on dashboard cart cards.
- Navigation: **Lexikon & Rechner** label and order.
- Design: warmer anthracite/gold tokens; compact admin dashboard stat cards.

### Fixed

- Final production fix: kit variant UI deployed, checkout currency (`USD subtotal → EUR → DE EUR`), PEPTIX logo + nav toggle, migration 0033 retained on prod.
- Production bundle uses `/peptix-logo.png` (original asset, 2172×724 RGBA).

## 2026-08-29 (kit sharing bugfix)

### Fixed

- `add_kit_share_to_cart` HTTP 400: production RPC referenced non-existent column `exchange_rates.exchange_rate` (Postgres **42703**); fixed to `exchange_rates.rate` in migration `0033_fix_add_kit_share_to_cart_exchange_rate.sql` (applied to cartwise-prod).
- Kit-share dialog: product strength/variant selection when a shop group has multiple kit-shareable variants; variant locked after kit creation; strength shown in dialog UI.

### Added

- Regression tests for `add_kit_share_to_cart` RPC contract and Retatrutide variant separation (`kitShareableVariants`).

## 2026-08-29

### Added

- Finalization: `feat: finalize research platform`. Full local backup `PEPTIX-FULL-BACKUP-FINAL-2026-08-29-1143`. Production dump SHA-256 `32ebd1db5430f5b9aede9cf19f9c980a0988ab78fc956b3919d245c571684b37`. Persist/citation/dual-read hardening included. No push.
- Full local platform backup: `docs/FULL_LOCAL_BACKUP_REPORT.md` — **BACKUP_COMPLETE_WITH_LIMITATIONS**. Location `Documents\PEPTIX-BACKUPS\PEPTIX-FULL-BACKUP-2026-08-29`. Working-tree SOURCE ZIP + public-schema dump of cartwise-prod. No `.env.local`, no auth.users rows, no commit, no push, no deploy. Isolated dump restore not run.
- Block 4 Final Research Operations: `docs/RESEARCH_FINAL_OPERATIONS_QA.md` — **FINAL_RELEASE_READY_WITH_LIMITATIONS**. Live `cartwise-prod` applied `0031_research_operations.sql` as MCP `research_operations` (`20260829082116`). Durable run persist in working tree. Community architecture empty. Reddit/BfArM/MHRA/NMPA unavailable. Shop/auth fingerprints unchanged. No auto-approve, no cron, no Batch 04, no commit, no push, no SPA deploy.
- Block 3 Research Operations: `docs/RESEARCH_OPERATIONS_BLOCK_3.md` — **RESEARCH_OPERATIONS_READY_WITH_LIMITATIONS**. Persisted runs, Admin Update All / Substance / Connector, cancel/retry/concurrency, connector health, community architecture. Prepared `0031_research_operations.sql` not applied. Cron off. No auto-approve, no community data, no production write, no commit, no push, no deploy.
- Block 2 Research Update Engine: `docs/RESEARCH_UPDATE_ENGINE_BLOCK_2.md` — **RESEARCH_UPDATE_ENGINE_READY_WITH_LIMITATIONS**. Connector contract, PubMed/CT.gov/FDA/EMA normalizers, identity + Hudson guards, change detection, scoped/partial runs, review-required persist plan (`productionWrite: false`). Prepared `0031_research_update_engine_runs.sql` not applied. Cron off. No auto-approve, no Batch 04, no production write, no commit, no push, no deploy.
- Phase 17 production 0030 + Batch 03 review intake: `docs/RESEARCH_PRODUCTION_MIGRATION_0030.md` — **PRODUCTION_0030_APPLY_SUCCESS_WITH_RLS_LIMITATION**. Live `cartwise-prod` is **0030**. 104 sources + 36 studies `review-required`. Shop/auth unchanged. No commit, no push, no deploy.
- Phase 16A realistic local 0030 validation: `docs/RESEARCH_MIGRATION_0030_REALISTIC_LOCAL_VALIDATION.md` — **READY_WITH_RLS_LIMITATION**. Isolated Docker restore of `cartwise-prod-0023-2026-08-28-full.sql` (hash match), 0024–0030, Batch 03 104/36 intake, GUC RLS pass, GoTrue JWT **NOT TESTED**. Production remains 0029. No commit, no push, no deploy.
- Phase 16 review intake persistence: `docs/RESEARCH_REVIEW_INTAKE_PERSISTENCE_PHASE_16.md` + `docs/RESEARCH_MIGRATION_0030_READINESS.md` — **READY_WITH_LIMITATIONS**. 0030 locally schema-tested on Docker Postgres (stub), not applied to production. Idempotent Batch 03 persist path (104 sources + 36 studies review-required, 4 relationship links). No production write, no auto-approve, no commit, no push, no deploy.
- Phase 15 Batch 03 review intake: `docs/RESEARCH_BATCH_03_REVIEW_INTAKE_PHASE_15.md` — **BATCH_03_REVIEW_INTAKE_READY_WITH_LIMITATIONS**. 108 candidates → 104 planned source imports + 4 relationship-only; 36 studies planned; **0 written** to production. `supabase/migrations/0030_research_source_study_review_intake.sql` is **MIGRATION_REQUIRED** and not applied. Admin Sources/Studies tabs show local review-required placeholders. No auto-approve, no claims/evidence/regulatory mutation, no commit, no push, no deploy.
- Phase 14 Batch 03 review readiness: `docs/RESEARCH_BATCH_03_REVIEW_READINESS.md` — **BATCH_03_REVIEW_READY_WITH_LIMITATIONS**. 108/36 candidates not in Admin queue (local cache only). 267 evidence review-required unchanged. No auto-approve, no import, no commit, no push, no deploy.
- Phase 12 production post-cutover audit: `docs/RESEARCH_PRODUCTION_POST_CUTOVER_AUDIT.md` — **PRODUCTION_POST_CUTOVER_PASS_WITH_LIMITATIONS**. Postgres primary confirmed on `https://cartwise-zeta.vercel.app`. DB still 0029. Exclusive fallback **NOT TESTED** on production. No commit, no push, no deploy.
- Phase 11C production SPA deploy of public lexicon Postgres cutover: `docs/RESEARCH_PRODUCTION_LEXICON_CUTOVER_PHASE_11C.md` — **PRODUCTION_LEXICON_CUTOVER_SUCCESS_WITH_LIMITATIONS**. `https://cartwise-zeta.vercel.app` (`pepsi7/cartwise`, `dpl_BVpbpXUCKnivEWxhh4gfeU9DwZRe`, commit `5e38cf1`). `VITE_RESEARCH_DB_MODE` unset → **postgres**. DB still 0029. Exclusive fallback **NOT TESTED** on production. No commit, no push.
- Logged-in production admin browser QA: `docs/RESEARCH_PRODUCTION_ADMIN_BROWSER_QA.md` — **BROWSER_QA_NOT_READY**. Admin Research (Postgres), mapping, lexicon list/search, shop, and cart pass. Lexicon detail pages and `/peptide/rechner` crash on the hosted SPA (`Slot failed to slot onto its children` in `button-C9NJmCLl.js`). No mutation, no deploy, no commit.

### Fixed

- Phase 10D: Radix Slot crash on lexicon detail and calculator (`Button asChild` always had a spinner sibling). `Slottable` wrap in `src/components/ui/button.tsx`. Tests `src/tests/button.test.tsx`. `docs/RESEARCH_UI_CRASH_FIX_PHASE_10D.md` — **UI_CRASH_FIXED**.
- Phase 10E: deployed that fix to `https://cartwise-zeta.vercel.app` (`pepsi7/cartwise`, `dpl_BTukrYBjxY1rAURuznPqgBhMxbHn`). Local commit `b079bbf`, not pushed. `docs/RESEARCH_UI_CRASH_FIX_DEPLOY_PHASE_10E.md` — **UI_FIX_DEPLOYED_AND_VERIFIED**. DB still 0029.

## 2026-08-28

### Added

- Phase 10C production SPA deploy: `docs/RESEARCH_PRODUCTION_DEPLOY_PHASE_10C.md` — **PRODUCTION_DEPLOY_SUCCESS_WITH_QA_LIMITATION**. `https://cartwise-zeta.vercel.app` aliased to `cartwise-kkl57nrul-pepsi7.vercel.app`. Migration still 0029. Logged-in admin QA not run.

- Phase 10B production deploy preflight: `docs/RESEARCH_DEPLOYMENT_PREFLIGHT_PHASE_10B.md` — **DEPLOYMENT_PREFLIGHT_PASS**. Peptix domain `https://cartwise-zeta.vercel.app` (`pepsi7/cartwise`). No migration on Vercel build. `VITE_RESEARCH_DB_MODE` unset → legacy. No push/deploy.

- Phase 10A local release backup commit `feat: persist research platform and admin workflow` — dual-read, admin Postgres UI, research migrations 0025–0029 in git (already live), Phase 9/9B docs. Not pushed. Not deployed. Public lexicon still files.

### Added (Phase 9, earlier this day)

- Phase 9 production browser QA: `docs/RESEARCH_PRODUCTION_BROWSER_QA_PHASE_9.md` — **BROWSER_QA_PASS_WITH_LIMITATIONS**. Hosted Peptix SPA is `https://cartwise-zeta.vercel.app` against `cartwise-prod`. No admin session in the QA browser; no review writes; no lexicon switch.

### Added (Phase 8, earlier this day)

- Phase 8 Admin Research Postgres: `docs/RESEARCH_ADMIN_POSTGRES_PHASE_8.md` — **ADMIN_POSTGRES_READY**. `/admin/research` reads Postgres (queue, evidence/regulatory/claim review, append-only `review_actions`, product mapping without prices). Public lexicon still `catalog.ts` + `published.json`. Tests `src/tests/researchAdminPostgresPhase8.test.ts`.

### Added (Phase 7, earlier this day)

- Phase 7 dual-read: `docs/RESEARCH_DUAL_READ_PHASE_7.md` — **DUAL_READ_READY**. Modes `legacy` (default) / `dual` / `postgres`. Lexicon UI still `catalog.ts` + `published.json`. Admin-only comparison + fallback. Tests `src/tests/researchDualReadPhase7.test.ts`.

### Changed

- Lexicon search matches name / alias / development name / slug / CAS only (no identity-note false match of TB-500 → Thymosin Beta-4). Production `VITE_RESEARCH_DB_MODE` stays `legacy`.

### Added (Phase 6C, earlier this day)

- Phase 6C production apply: `docs/RESEARCH_PRODUCTION_APPLY_0024_0029.md` — **PRODUCTION_APPLY_SUCCESS**. Live `cartwise-prod` has 0024–0029. Pre-apply dump: `docs/PRODUCTION_BACKUP_2026-08-28.md` (**BACKUP_READY_WITH_LIMITATION**). Lexicon still `catalog.ts` + `published.json`.

### Added (Phase 6B, earlier this day)

- Phase 6B production fixes (not applied): `docs/RESEARCH_PRODUCTION_FIXES.md` — READY_TO_APPLY
- `0028` evidence_assessments SELECT: admin all; non-admin only `review_status = approved` on approved claims (0026 unchanged)
- `0029` explicit `product_substances` manuals for unambiguous live SKUs; unmap MT1 and KL80; BT*/blends unresolved
- Tests `src/tests/researchProductionFixes.test.ts`

### Changed

- Lexicon still `catalog.ts` + `published.json`. Client mapper kept as legacy fallback. No live schema apply.

### Added (Phase 6A, earlier this day)

- Phase 6A production migration readiness: `docs/RESEARCH_PRODUCTION_MIGRATION_READINESS.md` — GO_WITH_FIXES; 0024–0027 not applied
- Prepared (not applied) `supabase/migrations/0028_research_evidence_assessments_select_approved.sql` so non-admins cannot read review-required evidence; 0026 unchanged
- Tests `src/tests/researchProductionMigrationReadiness.test.ts`

### Changed

- Lexicon still `catalog.ts` + `published.json`. No dual-read. No live schema apply.

### Added (Phase 5, earlier this day)

- Research Persistence Phase 5 readiness audit: `docs/RESEARCH_PERSISTENCE_PHASE_5_READINESS.md` — seed vs catalog/published.json parity, live DB still on 0023, lexicon switch NOT_READY
- Tests `src/tests/researchPersistencePhase5.test.ts`

### Changed

- Dual-read remains `legacy`; lexicon still reads `published.json`. No schema or research-data edits in Phase 5.

### Added (Phase 4, earlier this day)

- Research Persistence Phase 4: Postgres regulatory_records, regulatory_history, review_actions (`supabase/migrations/0027_research_regulatory_and_review.sql`) — 41 regional records from published.json regulatory sources, 19 request_review actions from reviewItems; 0 invented history rows; empty FDA/EMA search not stored as not_approved
- Report `docs/RESEARCH_PERSISTENCE_PHASE_4.md`

### Changed

- Database types include regulatory_records / regulatory_history / review_actions
- Dual-read remains `legacy`; lexicon still reads `published.json`

### Research persistence

- Regulatory status is regional and product-specific; Ovitrelle is not a current urinary hCG EU approval; Retatrutide stays clinical_development
- Community **not** migrated; 267 evidence assessments remain review-required

### Added (Phase 3, earlier this day)

- Research Persistence Phase 3: Postgres claims, claim_sources, evidence_assessments (`supabase/migrations/0026_research_claims_and_evidence.sql`) — 294 cited claims from published.json, 472 source links, 27 overlay A–F assessments on humanEvidence; Hudson NCTs produce no claims
- Report `docs/RESEARCH_PERSISTENCE_PHASE_3.md`

### Changed

- Database types include claims / claim_sources / evidence_assessments
- Dual-read remains `legacy`; lexicon still reads `published.json`

### Research persistence

- Claims are slot-keyed statements, not split paragraphs; A–F is not stored on `claims`
- Regulatory_records and community **not** migrated

### Added (Phase 2, earlier this day)

- Research Persistence Phase 2: Postgres sources, studies, research runs (`supabase/migrations/0025_research_sources_studies_runs.sql`) — 412 unique sources, 118 unique NCT studies from 468/123 published.json rows; Hudson NCTs excluded; historical_import runs for Batch 01/02
- Report `docs/RESEARCH_PERSISTENCE_PHASE_2.md`

### Changed

- Database types include research run / source / study tables and junctions
- Dual-read helper `lexiconUsesPostgresScience()` prepared; lexicon still reads `published.json`

### Research persistence

- Dedup by PMID → DOI → NCT → published source id; many-to-many `source_substances` / `study_substances`
- Claims, evidence A–F, regulatory_records, community **not** migrated

### Added (Phase 1, earlier this day)

- Research Persistence Phase 1: Postgres identity + product mapping (`supabase/migrations/0024_research_identity_and_product_mapping.sql`) — 27 substances, 46 aliases, glow-blend components; `product_substances` FK to existing `products` without altering shop columns
- Dual-read helper `VITE_RESEARCH_DB_MODE` (`legacy` default); lexicon still reads `catalog.ts` + `published.json`
- Report `docs/RESEARCH_PERSISTENCE_PHASE_1.md`

### Changed

- Client prefix rules exported as `PRODUCT_CODE_PREFIX_RULES`; mapping behavior unchanged
- Database types include the four identity/mapping tables and `refresh_product_substance_prefix_mappings`

### Research persistence

- Identity status is lifecycle (`active` / `blend` / …), not evidence A–F
- TB-500, Thymosin Beta-4, Melanotan II, IGF-1 LR3 remain separate identities
- Sources, studies, claims, evidence, regulatory, community **not** migrated

### Added (Batch 02, earlier this day)

- Research Batch 02: 12 remaining identity substances compiled into `published.json` (sermorelin, thymosin-beta-4, semax, selank, thymosin-alpha-1, kpv, igf-1-lr3, somatropin, hcg, gonadorelin, melanotan-ii, glow-blend)
- Report `docs/RESEARCH_BATCH_02_REPORT.md` and snapshot `docs/snapshots/2026-08-28-research-batch-02.md`
- Title/sponsor filters for noisy Batch 02 CT.gov/PubMed queries; glow-blend mapping-only profile

### Changed

- All 27 catalog slugs now have a published overlay; identity defaults remain F until overlay
- Batch 02 exclusive research-status counting: 9 Complete + 1 Partial + 2 Review Required = 12 (`reviewStatus` is orthogonal; gonadorelin is not counted twice)
- Fetch scripts accept `batch01` / `batch02` / `all`

### Fixed

- Excluded Hudson NCT07437560 from Melanotan II publication; skipped wrong HCG PubChem CID 1108 and sheep IGF-1 PMID 22227200

### Research

- Somatropin US+EU labels/EPAR; hCG US label with obesity non-indication; TB4 kept distinct from TB-500 with own C-level profile
- Community still unavailable

### Added (earlier this day)

- Project memory docs: `PROJECT_STATE.md`, `ARCHITECTURE.md`, `TODO.md`, this changelog, snapshot `docs/snapshots/2026-08-28-peptide-platform.md`, Cursor rule `.cursor/rules/project-memory.mdc`
- Independent peptide area: `/peptide`, calculator, lexicon, admin research
- Official-API research batch (15 substances) compiled to `published.json`
- Research Batch 01 quality audit report `docs/RESEARCH_AUDIT_BATCH_01.md` and snapshot `docs/snapshots/2026-08-28-research-batch-01-audited.md`
- Published profile fields `regulatoryRegions` and `reviewItems`; Admin Research queue lists review items
- Shop storefront categories, orders/checkout, Discord-only OAuth hardening, customer role selling prices, shipping admin (present vs last origin commit)

### Changed

- Branding surface name Peptix; navigation includes Rechner & Lexikon outside shop
- Identity catalog remains F/insufficient until a sourced profile is applied
- Search-count sources classified as scientific (not primary trials)
- Orforglipron/Mazdutide development names on identity catalog

### Fixed

- Excluded fictional CT.gov example NCT07487363 and Hudson Biotech cluster from published studies
- Removed misassigned published NCTs (ipamorelin ibogaine study, tesamorelin generic GHRH MCI, GHK X39 patch, MOTS-c biomarker)

### Architecture

- Architecture analysis (no implementation): `docs/RESEARCH_PERSISTENCE_ARCHITECTURE.md` — research remains file-based; Postgres target schema and migration order documented
- Browser connectors stay unavailable; Node scripts perform allowed API reads
- Review items live on compiled profiles, not a new Postgres queue

### Research

- ClinicalTrials.gov, PubMed, openFDA, PubChem, EMA EPAR HTTP check (2026-08-28)
- Reddit/community unavailable
- TB-500 kept distinct from Thymosin Beta-4; fictional NCT not treated as a trial
- No fabricated NCT/PMID/approvals
- Quality audit: evidence/regulatory enums unchanged; US/EU regions stored where sourced

## 2026-08-27 and earlier (committed)

See `git log` on `main`. Notable committed messages: env example ignore fix, `.vercel` ignore, Supabase malformed env guard, bulk pricing and product import.

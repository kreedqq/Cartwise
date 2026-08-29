# Changelog

Only material changes. Dates are local project days.

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

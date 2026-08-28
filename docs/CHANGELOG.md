# Changelog

Only material changes. Dates are local project days.

## 2026-08-28

### Added

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

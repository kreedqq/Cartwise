# TODO

Code wins if this list drifts. Check boxes only when the **code** has the behavior.

# Critical

- [x] User-approved git backup of the dirty `main` working tree (`0da9c90`; do not commit unless asked)
- [x] Phase 10A local release backup (`feat: persist research platform and admin workflow`; not pushed)
- [x] Production deploy preflight (Phase 10B) — **DEPLOYMENT_PREFLIGHT_PASS** (`docs/RESEARCH_DEPLOYMENT_PREFLIGHT_PHASE_10B.md`); no push/deploy yet
- [x] Keep Discord OAuth `skipBrowserRedirect` / no `authorize.json` download
- [x] Shop selling prices only via shop RPCs (not lexicon)

# High

- [x] Peptide routes outside `/shop`
- [x] Calculator without invented IU conversions
- [x] First research batch with cited official sources (15 substances)
- [x] TB-500 ≠ Thymosin Beta-4
- [x] Research Batch 01 quality audit (no Batch 02 at audit time)
- [x] Research Batch 02 for remaining identity substances (12 slugs; exclusive: 9 complete, 1 partial igf-1-lr3, 2 review-required TA-1 + gonadorelin)
- [ ] Resolve remaining Review Required: Mazdutide NMPA, Orforglipron EMA, Hudson cluster, Zadaxin primary label, gonadorelin title-restricted literature
- [x] Persist substance **identity** + product mapping in Postgres (Phase 1: `substances`, aliases, components, `product_substances`; lexicon still file-based)
- [x] Persist sources, studies, and historical research runs in Postgres (Phase 2; lexicon still file-based)
- [x] Persist claims + evidence assessments in Postgres (Phase 3; lexicon still file-based; A–F only on published humanEvidence overlay)
- [x] Persist regulatory records + review actions in Postgres (Phase 4; lexicon still file-based; community not migrated; 267 evidence assessments not auto-approved)
- [x] Phase 5 research DB reconciliation / migration readiness audit (no lexicon switch)
- [x] Phase 6A production apply readiness (GO_WITH_FIXES; 0024–0027 not applied; 0028 prepared for evidence SELECT)
- [x] Phase 6B pre-apply fixes (0028 evidence RLS; 0029 explicit product mappings; READY_TO_APPLY; not applied)
- [x] Phase 6C production apply 0024–0029 — **PRODUCTION_APPLY_SUCCESS** (`docs/RESEARCH_PRODUCTION_APPLY_0024_0029.md`)
- [x] Dual-read legacy vs Postgres (Phase 7) — **DUAL_READ_READY**; lexicon still files (`docs/RESEARCH_DUAL_READ_PHASE_7.md`)
- [x] Admin Research Postgres read + review actions (Phase 8) — **ADMIN_POSTGRES_READY**; public lexicon still files (`docs/RESEARCH_ADMIN_POSTGRES_PHASE_8.md`)
- [x] Production browser QA (Phase 9) — **BROWSER_QA_PASS_WITH_LIMITATIONS** (`docs/RESEARCH_PRODUCTION_BROWSER_QA_PHASE_9.md`); logged-in admin/lexicon/shop still needs a human session
- [x] Deployment readiness audit (Phase 9B) — **DEPLOYMENT_READY** (`docs/RESEARCH_DEPLOYMENT_READINESS_PHASE_9B.md`); no commit/push/deploy yet
- [ ] Persist community in Postgres / switch lexicon read path — later phases; see `docs/RESEARCH_PERSISTENCE_PHASE_5_READINESS.md`
- [x] Populate remaining identity substances with verified sources (Batch 02; Partial: IGF-1 LR3; Review Required: gonadorelin, thymosin-alpha-1)
- [ ] Server-side live connectors (no secrets in the client) if ongoing scans are required
- [ ] Official Reddit API or keep connector unavailable (no scraping)

# Medium

- [ ] BfArM / MHRA connectors when a supported API exists
- [ ] Numeric PK from labels only when the exact figure is extracted and cited
- [x] Glow-blend: scientific notes per component, still no shop prices
- [ ] Split or lazy-load `published.json` (catalog chunk size)
- [ ] Logged-in browser QA of peptide + shop regression
- [ ] Import `GENXELL_…xlsx` if the file is provided (file is not in the repo)

# Low

- [ ] Rename npm package `shared-cart-app` if desired
- [ ] Clear the five `react-refresh/only-export-components` lint warnings
- [ ] Research digest (“what changed this week”) once updates are persisted
- [ ] Optional substance field changelog

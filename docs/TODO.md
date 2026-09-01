# TODO

Code wins if this list drifts. Check boxes only when the **code** has the behavior.

# Critical

- [x] Kit sharing 3.0: username system + creator participant removal + Cart/Checkout kit editing — **DEPLOYED_WITH_LIMITATIONS** (migration `0038`; commit `c7906e4`; see chat release report); no real second test account for live two-user E2E; Admin visual redesign (Phase 30) and full mobile/browser QA (Phase 37/38) not performed — TEST LIMITATION
- [x] User-approved git backup of the dirty `main` working tree (`0da9c90`; do not commit unless asked)
- [x] Phase 10A local release backup (`feat: persist research platform and admin workflow`; not pushed)
- [x] Production deploy preflight (Phase 10B) — **DEPLOYMENT_PREFLIGHT_PASS** (`docs/RESEARCH_DEPLOYMENT_PREFLIGHT_PHASE_10B.md`); no push/deploy yet
- [x] Production SPA deploy (Phase 10C) — **PRODUCTION_DEPLOY_SUCCESS_WITH_QA_LIMITATION** (`docs/RESEARCH_PRODUCTION_DEPLOY_PHASE_10C.md`)
- [x] Logged-in production admin browser QA — **BROWSER_QA_NOT_READY** (`docs/RESEARCH_PRODUCTION_ADMIN_BROWSER_QA.md`); lexicon detail + calculator crash on hosted SPA
- [x] Phase 10D local UI crash fix — **UI_CRASH_FIXED** (`docs/RESEARCH_UI_CRASH_FIX_PHASE_10D.md`)
- [x] Phase 10E commit + production deploy of UI crash fix — **UI_FIX_DEPLOYED_AND_VERIFIED** (`docs/RESEARCH_UI_CRASH_FIX_DEPLOY_PHASE_10E.md`); `b079bbf` not pushed
- [x] Phase 11 public lexicon Postgres cutover — **LEXICON_CUTOVER_READY** (`docs/RESEARCH_PUBLIC_LEXICON_CUTOVER_PHASE_11.md`); local commit `5e38cf1`, not pushed
- [x] Phase 11A lexicon cutover release audit — **LEXICON_RELEASE_READY** (`docs/RESEARCH_LEXICON_CUTOVER_RELEASE_AUDIT.md`)
- [x] Phase 11B local commit `feat: switch public lexicon to postgres` — no push
- [x] Phase 11C production SPA deploy — **PRODUCTION_LEXICON_CUTOVER_SUCCESS_WITH_LIMITATIONS** (`docs/RESEARCH_PRODUCTION_LEXICON_CUTOVER_PHASE_11C.md`); no DB change; 11C docs not committed
- [x] Phase 12 production post-cutover audit — **PRODUCTION_POST_CUTOVER_PASS_WITH_LIMITATIONS** (`docs/RESEARCH_PRODUCTION_POST_CUTOVER_AUDIT.md`); no commit, no push
- [x] Phase 12A limitation cleanup — **POST_CUTOVER_READY_WITH_DOCUMENTED_FALLBACK_LIMITATION** (`docs/RESEARCH_POST_CUTOVER_LIMITATIONS_PHASE_12A.md`); Dual Read copy in source; not deployed
- [x] Phase 13 Research Batch 03 — **RESEARCH_BATCH_03_COMPLETE_WITH_REVIEW** (`docs/RESEARCH_BATCH_03_REPORT.md`); local cache only; not deployed
- [x] Phase 14 Batch 03 review readiness — **BATCH_03_REVIEW_READY_WITH_LIMITATIONS** (`docs/RESEARCH_BATCH_03_REVIEW_READINESS.md`); no import/auto-approve
- [x] Phase 15 Batch 03 review intake — **BATCH_03_REVIEW_INTAKE_READY_WITH_LIMITATIONS** (`docs/RESEARCH_BATCH_03_REVIEW_INTAKE_PHASE_15.md`); 0030 later applied in Phase 17
- [x] Phase 16 review intake persistence — **READY_WITH_LIMITATIONS** (`docs/RESEARCH_MIGRATION_0030_READINESS.md`); 0030 locally schema-tested, not applied; persist path ready; 0 production rows written
- [x] Phase 16A realistic local 0030 validation — **READY_WITH_RLS_LIMITATION** (`docs/RESEARCH_MIGRATION_0030_REALISTIC_LOCAL_VALIDATION.md`); isolated Docker restore+intake; GoTrue JWT not tested; production remains 0029
- [x] Phase 17 production 0030 + Batch 03 intake — **PRODUCTION_0030_APPLY_SUCCESS_WITH_RLS_LIMITATION** (`docs/RESEARCH_PRODUCTION_MIGRATION_0030.md`); live 0030; 104+36 review-required; no SPA deploy
- [x] Block 2 Research Update Engine — **RESEARCH_UPDATE_ENGINE_READY_WITH_LIMITATIONS** (`docs/RESEARCH_UPDATE_ENGINE_BLOCK_2.md`); engine core; 0031 applied in Block 4; no persist/cron/auto-approve in Block 2 itself
- [x] Block 3 Research Operations — **RESEARCH_OPERATIONS_READY_WITH_LIMITATIONS** (`docs/RESEARCH_OPERATIONS_BLOCK_3.md`); session persist + Admin Update All; 0031 later applied in Block 4; no cron/auto-approve/community data
- [x] Block 4 Final Research Operations — **FINAL_RELEASE_READY_WITH_LIMITATIONS** (`docs/RESEARCH_FINAL_OPERATIONS_QA.md`); live 0031 (`research_operations`); durable run persist in working tree
- [x] Full local platform backup — **BACKUP_COMPLETE_WITH_LIMITATIONS** (`docs/FULL_LOCAL_BACKUP_REPORT.md`); `Documents\PEPTIX-BACKUPS\PEPTIX-FULL-BACKUP-2026-08-29`; no commit/push/deploy
- [x] Final release backup + SPA deploy + live E2E — **FINAL_RELEASE_READY_WITH_LIMITATIONS** (`docs/RESEARCH_FINAL_RELEASE_QA.md`); SPA `dpl_6pYjonptAdnDXzUMfxPffF2LVks5`; Update All `6648684b`; no Batch 04; no commit; no push
- [x] Final research hardening — **FINAL_RELEASE_READY_WITH_LIMITATIONS** (`docs/RESEARCH_FINAL_HARDENING.md`); persist UNCHANGED preserves status; Claim Sources vs Source References; Dual Read exclusive; dump 1130; no deploy
- [x] Finalization backup + commit `feat: finalize research platform` — `PEPTIX-FULL-BACKUP-FINAL-2026-08-29-1143`; dump SHA-256 `32ebd1db5430f5b9aede9cf19f9c980a0988ab78fc956b3919d245c571684b37`; not pushed
- [x] Telegram Login via existing Custom OIDC provider `custom:telegram` on the existing login screen (no DB/RLS/cart/kit changes; no insecure account merge)
- [x] Keep Discord OAuth `skipBrowserRedirect` / no `authorize.json` download
- [x] Stabilize password-login session redirect and OAuth callback double-exchange; document Production Site URL `https://peptix.app` (manual dashboard if CLI cannot set it)
- [x] Shop selling prices only via shop RPCs (not lexicon)

# High

- [x] Checkout Lieferart (Haustür / Paketstation) + order snapshot (`0045`); customer **Meine Bestellungen**; admin **Bestelleingänge** + grouped admin nav; admin Bestellzusammenfassung PDF
- [x] Telegram Benutzername as the only public handle; stable cart ordinals; checkout shipping + telegram order snapshots (migration `0042`)
- [x] Unify public username (`profiles.username`) + cart titles; remove redundant shop `ab X` badge (migration `0040`)
- [x] Kit Gesuche marketplace on existing `kit_shares` (migration `0041` applied to production; invite kit sharing unchanged)
- [x] Personal-data cleanup: generic test fixtures and anonymized local paths in docs/scripts (no product/price/RLS changes)
- [x] Orals pack/variant display (`formatProductVariant`) + BPC/BPC157 shop split; 0-price SKUs audited as BLOCKER (no DB price writes)
- [x] Peptide routes outside `/shop`
- [x] Calculator without invented IU conversions
- [x] First research batch with cited official sources (15 substances)
- [x] TB-500 ≠ Thymosin Beta-4
- [x] Research Batch 01 quality audit (no Batch 02 at audit time)
- [x] Research Batch 02 for remaining identity substances (12 slugs; exclusive: 9 complete, 1 partial igf-1-lr3, 2 review-required TA-1 + gonadorelin)
- [x] Research Batch 03 quality/recency/coverage — **RESEARCH_BATCH_03_COMPLETE_WITH_REVIEW**; 108/36 new hits held review-required; production inventory unchanged
- [ ] Resolve remaining Review Required: Mazdutide NMPA, Orforglipron EMA, Hudson cluster, Zadaxin primary label, gonadorelin title-restricted literature, Batch 03 held NCT/PMID candidates (imported review-required in Phase 17; no auto-approve)
- [x] Persist substance **identity** + product mapping in Postgres (Phase 1: `substances`, aliases, components, `product_substances`; lexicon still file-based)
- [x] Persist sources, studies, and historical research runs in Postgres (Phase 2; lexicon still file-based)
- [x] Persist claims + evidence assessments in Postgres (Phase 3; lexicon still file-based; A–F only on published humanEvidence overlay)
- [x] Persist regulatory records + review actions in Postgres (Phase 4; lexicon still file-based; community not migrated; 267 evidence assessments not auto-approved)
- [x] Phase 5 research DB reconciliation / migration readiness audit (no lexicon switch)
- [x] Phase 6A production apply readiness (GO_WITH_FIXES; 0024–0027 not applied; 0028 prepared for evidence SELECT)
- [x] Phase 6B pre-apply fixes (0028 evidence RLS; 0029 explicit product mappings; READY_TO_APPLY; not applied)
- [x] Phase 6C production apply 0024–0029 — **PRODUCTION_APPLY_SUCCESS** (`docs/RESEARCH_PRODUCTION_APPLY_0024_0029.md`)
- [x] Dual-read legacy vs Postgres (Phase 7) — **DUAL_READ_READY**; public lexicon later switched in Phase 11 (`docs/RESEARCH_DUAL_READ_PHASE_7.md`)
- [x] Admin Research Postgres read + review actions (Phase 8) — **ADMIN_POSTGRES_READY** (`docs/RESEARCH_ADMIN_POSTGRES_PHASE_8.md`)
- [x] Production browser QA (Phase 9) — **BROWSER_QA_PASS_WITH_LIMITATIONS** (`docs/RESEARCH_PRODUCTION_BROWSER_QA_PHASE_9.md`); logged-in admin/lexicon/shop still needs a human session
- [x] Deployment readiness audit (Phase 9B) — **DEPLOYMENT_READY** (`docs/RESEARCH_DEPLOYMENT_READINESS_PHASE_9B.md`); no commit/push/deploy yet
- [x] Persist community schema in Postgres after 0031 (`community_reports` empty until an official connector)
- [x] Apply 0031 and persist Update Engine / Operations runs to Postgres (review-required only; no auto-approve; live Update All `6648684b` executed; SPA deployed)
- [x] Official Reddit API or keep connector unavailable (no scraping) — **unavailable** as of 2026-08-29

# Medium

- [ ] BfArM / MHRA / NMPA connectors when a supported API exists (unavailable as of 2026-08-29; no scraping)
- [ ] Server-side live connectors (no secrets in the client) if ongoing scans are required
- [x] Populate remaining identity substances with verified sources (Batch 02; Partial: IGF-1 LR3; Review Required: gonadorelin, thymosin-alpha-1)
- [ ] Numeric PK from labels only when the exact figure is extracted and cited
- [x] Glow-blend: scientific notes per component, still no shop prices
- [ ] Split or lazy-load `published.json` (catalog chunk size)
- [x] Logged-in browser QA of peptide + shop (2026-08-29): shop/cart/admin pass; lexicon detail + calculator FAIL (`docs/RESEARCH_PRODUCTION_ADMIN_BROWSER_QA.md`)
- [x] Import/abgleich `GENXELL_Warenkorb_8_Kunden_FINAL(1).xlsx` (read-only): 22 OUT OF STOCK already inactive; five 0-price SKUs later operator-deactivated (`B1201`, `B1210`, `GGH`, `HHB`, `SHB`) without invented prices
- [x] Keep BPC / BPC157 out of Reconstitution Water in shop mapping and Kit Gesuche filters

# Low

- [ ] Rename npm package `shared-cart-app` if desired
- [ ] Clear the five `react-refresh/only-export-components` lint warnings
- [ ] Research digest (“what changed this week”) once updates are persisted
- [ ] Optional substance field changelog

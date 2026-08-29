# Research Final Operations QA (Block 4)

**Verdict: `FINAL_RELEASE_READY_WITH_LIMITATIONS`**

Date: 2026-08-29. Production: **cartwise-prod** `cnjrjinvxycdkrmzcime` (eu-west-2).

This is **not** Batch 04. No new substances. No automatic evidence, regulatory, or claim approval. No commit, no push, no SPA deploy, no cron.

---

## 0031

File: `supabase/migrations/0031_research_operations.sql`

Schema-only: extends `research_runs` / `research_run_sources`, adds `research_connector_health` and `community_reports`, admin-only run SELECT, `community_report` on `review_actions`.

Does **not** UPDATE/DELETE science rows. Does **not** INSERT sources/studies/claims/community. Does **not** touch products, prices, carts, orders, or auth.

Applied to production via Supabase MCP `apply_migration` name `research_operations`.

**Version label limitation:** MCP recorded `supabase_migrations.schema_migrations.version = 20260829082116` (name `research_operations`), not the string `0031`. Objects match the 0031 SQL. Do not re-apply 0024–0030. Do not re-apply this SQL.

## Backup (not in git)

| File | Bytes | SHA-256 | Timestamp | Kind |
|---|---|---|---|---|
| `C:\Users\PolatMehmetErkan\Documents\cartwise-prod-backup\cartwise-prod-0023-2026-08-28-full.sql` | 1230487 | `dae0ef581968cdd7a33eb5dc34c44064a0ff8fbfaa89a666b6e25d5897cb973a` | 2026-08-28 21:30 | Restore-capable full dump (0023) |
| `...\cartwise-prod-0030-2026-08-29-full.sql` | 154380 | `4fa7999f27b42d8e56fd2f6fb402626d42d4ecdb4db39ac76412666ab73cc821` | 2026-08-29 10:07 | Schema-only 0030 |
| `...\cartwise-prod-0030-2026-08-29-data.sql` | 1605541 | `2ec97dd8935a388b80f98b69da595b466fe55eb4a86d7670b813c6d3520bdc8e` | 2026-08-29 10:18 | Data-only 0030 (`pg_dump` warned circular FK on `claims`) |

No post-0031 dump created. Science row counts were unchanged by 0031.

## Local migration validation

Script: `scripts/block4-local-0031-validation.mjs`  
Snapshot: `docs/snapshots/2026-08-29-block4-local.json`

0023 dump hash match → 0024–0031 → Batch 03 intake.

After 0031 (before intake): sources 412, studies 118, claims 294, evidence 294, regulatory 41, review_actions 19, products 320, orders 0, users 2, `community_reports` 0.

After Batch 03 (idempotent): sources **516**, studies **154**, src_rr **104**, stu_rr **36**, claims **294**, evidence **294** (267 rr / 27 approved), regulatory **41**, mappings **93**, review_actions **19**. Hudson 0. Shop fingerprint `afd9f04bbf360fb5944709f30d653973` unchanged.

## Research runs

After 0031, Admin Operations writes `research_runs` + retrieval logs to Postgres (`src/lib/peptide/research/operations/postgres.ts`). History loads from Postgres with explicit columns and pagination (page size 20). Session store remains fallback if schema is missing.

Reload / new browser session: history is durable **once the Block 4 SPA is deployed**. Hosted SPA is still `5e38cf1` and does not include this persist path.

Production currently has **2** historical `research_runs` (pre-0031, `completed`). No new live run was started from this session.

## Update All / Single Substance / Single Connector

Admin panel: Update All, Update Substance, Update Connector, Substance + Connector, Cancel, Retry.

Scope is identity catalog (27 substances) × available scientific connectors. Does not query shop products. Persist plan is review-required only (`OPERATIONS_PRODUCTION_WRITE = false`). Claims/evidence/regulatory are not written.

Connectors in the SPA are **cache-backed** (Batch 03 `import.meta.glob`). Not live NCBI/openFDA HTTP from the browser (no client secrets).

**Live production Update All / Retatrutide / PubMed: NOT RUN.** Hosted Admin UI is the pre-Block-4 SPA. No invented statistics.

Unit tests cover scoped runs, idempotency (UNCHANGED / no duplicates), connector failure → `partial`, retry, cancel (no persist on cancel), and full-run block in-session. Postgres unique index `research_runs_one_active_full` blocks a second *running* full run.

## Review / Approve / Reject

Admin `submitAdminReview` already writes append-only `review_actions` and updates `review_status` for UUID sources/studies. No claim/evidence/regulatory auto-change.

Local Docker: approve path in a transaction then rollback → review_actions stayed 19, src_rr stayed 104.

**Production approve/reject of a new 0031 candidate: NOT RUN** (no live Update All to create a new candidate; Batch 03 rows remain review-required until a human admin acts).

## RLS

Label: **`RLS_VERIFIED_WITH_JWT_LIMITATION`**

GUC simulation (not a GoTrue-signed JWT):

| Role | Sources rr | Sources approved | Studies rr | Review actions | Community | Runs |
|---|---|---|---|---|---|---|
| anon grants | no SELECT | no | no | no | no | no |
| authenticated non-admin | 0 | 412 | 0 | 0 | 0 | 0 |
| admin | 104 | (all) | 36 | 19 | 0 | 2 |
| non-admin insert review_actions | DENIED | | | | | |

GoTrue JWT: **NOT TESTED**.

## Public lexicon

Postgres primary. Sources/studies/claims/evidence filtered `approved`. Batch 03 review-required hidden (local public counts: 412 approved sources / 118 approved studies). Exclusive file fallback (`catalog.ts` + `published.json`) is all-or-nothing; `community_reports` is fetched separately and empty-on-error so a missing table does not mix or fail science.

Headings: **Scientific Research** vs **Community Experience**. Community reports render only when `review_status = approved` (currently 0).

## Admin

`/admin/research`: dashboard, Sources, Studies, Claims, Evidence, Regulatory, Mappings, Review Actions, Research Operations (runs + connector health + community unavailable). Dual Read debug unchanged.

## Community / Reddit / BfArM / MHRA / NMPA

| Connector | Status | Reason |
|---|---|---|
| PubMed, ClinicalTrials.gov, FDA, EMA | available (Node/cache) | Official APIs |
| Reddit | **unavailable** | No permitted official API credentials. No scraping, HTML scrapers, or unofficial mirrors. |
| BfArM | **unavailable** | AMIce is a web database, not a documented machine API. |
| MHRA | **unavailable** | products.mhra.gov.uk is a search UI; MHRA-GMDP is manufacturing certificates, not INN approvals. |
| NMPA | **unavailable** | eCTD/applicant portals, not a public drug-approval API. No third-party mirrors as official. |
| forum / blog / user-report | unavailable | No official connectors configured. |

`community_reports` default `review-required`. Community cannot raise evidence A–F, claims, or regulatory. **0 rows.**

## Shop / Auth regression

Pre- and post-0031 production fingerprints identical:

- products **320**, price_sum **23925**, product_fp **`afd9f04bbf360fb5944709f30d653973`**
- orders **0**, carts **6**
- auth.users **2**, user_fp **`76af77941b50c8bc6ff620fc81e9ac50`**

Browser shop/cart mutation: **NOT RE-RUN** this block (counts prove no SQL mutation). Auth login/logout: **NOT RE-RUN**.

## Performance

Admin/public selects use explicit columns and `.range` pagination (page 20 / 200). No `SELECT *` on large research tables in the operations persist path. Indexes: existing `sources_review_status_idx` / `studies_review_status_idx`; 0031 adds `research_runs_status_started_idx`, `research_runs_parent_run_id_idx`, `research_run_sources_run_retrieved_idx`, community substance/kind indexes.

Supabase performance advisor: INFO-level unindexed FKs (including pre-existing `claims_supersedes_claim_id_fkey`). No unrelated index migration applied.

## Security

Client bundle must not contain API keys/tokens (env names only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Run errors are sanitized.

Supabase Security Advisor (pre-existing; **not** auto-fixed):

- **ERROR (2):** `admin_user_directory` exposed auth.users; SECURITY DEFINER view.
- **WARN:** mutable `search_path` on many functions; anon/authenticated EXECUTE on SECURITY DEFINER RPCs (shop/auth helpers); leaked password protection disabled.

These are unrelated to 0031. Documented only.

## Mobile

Layout: Scientific / Community sections stack; run history table is `overflow-x-auto`. **390×844 browser pass: NOT RUN** (SPA not redeployed).

## Hudson / Identity / Regulatory / Claims / Evidence

Hudson NCT07487363 / NCT07437560: **0** after local intake and on production.

Identity unchanged: TB-500 ≠ Thymosin Beta-4; Melanotan II ≠ Afamelanotide; IGF-1 LR3 ≠ Mecasermin; Glow Blend = blend; urinary hCG ≠ Ovitrelle.

Claims **294**. Evidence **294** (267 review-required, 27 approved A–F overlays). Regulatory **41**. No automatic status change. FDA empty search is not `not_approved`. EMA 404 is not evidence. No Global Approved.

## Final production counts (post-0031)

| Entity | Count |
|---|---|
| substances | 27 |
| sources | 516 (412 approved / 104 review-required) |
| studies | 154 (118 approved / 36 review-required) |
| claims | 294 |
| evidence | 294 (267 rr / 27 approved) |
| regulatory | 41 |
| review_actions | 19 |
| product mappings | 93 |
| products | 320 |
| orders | 0 |
| auth users | 2 |
| research_runs | 2 (historical completed) |
| community_reports | 0 |
| Hudson NCT | 0 |

## End-to-end

Local/unit: Run → review-required candidate → approve/reject in-memory + Admin persist path exists.

**Production E2E Run → Approve → Public / Reject → not public: NOT COMPLETED** (no live admin run on the undeployed SPA). Batch 03 candidates remain review-required and not public.

## Known limitations

1. Hosted SPA still `5e38cf1` — Block 4 UI and Postgres run persist are **not deployed**.
2. Live Update All / Retatrutide / PubMed on production **not executed**.
3. Update All uses Batch 03 cache, not live HTTP from the client.
4. RLS GoTrue JWT **NOT TESTED** (`RLS_VERIFIED_WITH_JWT_LIMITATION`).
5. Reddit / BfArM / MHRA / NMPA **unavailable**.
6. Community table empty.
7. Cron **disabled**.
8. MCP migration version is `20260829082116`, not `0031`.
9. Exclusive public fallback **not retested** on production.
10. Mobile 390×844 **not browser-tested** this block.
11. Security Advisor ERROR/WARN findings pre-exist and were not changed.
12. Data-only 0030 dump has circular FK warning on `claims`.
13. Dual Read copy on hosted SPA still lags the working tree.

## Test gates (working tree)

Re-run after test fixes: **486 passed / 40 files**. Lint: 0 errors, 5 pre-existing `react-refresh` warnings. Build: pass. Admin Research chunk ~127 kB.

## Stop

No Batch 04. No further research sources. No cron. No git commit. No push. No extra production change after 0031.

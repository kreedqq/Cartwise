# Final hardening — research platform

**Verdict: `FINAL_RELEASE_READY_WITH_LIMITATIONS`**

Date: 2026-08-29. Production: **cartwise-prod** `cnjrjinvxycdkrmzcime`, migration **0031**. Hosted SPA remains `dpl_6pYjonptAdnDXzUMfxPffF2LVks5` (not redeployed). No Batch 04. No git commit. No push. No production SQL.

This block fixes the documented limitations from `docs/RESEARCH_FINAL_RELEASE_QA.md` in the **working tree**. Applying the persist and lexicon UI fixes to the hosted SPA requires a later, explicit deploy.

---

## Update demotion fix

UNCHANGED and DUPLICATE no longer change `review_status`.

| Disposition | Persist |
|---|---|
| NEW | insert, `review-required` |
| UPDATED (title or publication date after normalize) | update fields, store previous title/date, `review-required` |
| UNCHANGED | no write; approved / review-required / rejected preserved |
| DUPLICATE | no new row; no status change |
| Uncertain identity | `REVIEW_REQUIRED` → `review-required` |

Date/title comparison ignores whitespace and `YYYY-MM-DD` vs `YYYY-MM-DDThh:mm:ss` so format-only rows are not UPDATED.

Postgres persist writes `review_status: review-required` **only** for `updatedSourceIds` / `updatedStudyIds`. Those lists are filled only for UPDATED (and study UPDATED). Claims / evidence / regulatory are still never written.

Review approve/reject remains append-only `review_actions` (push only).

## Citation coverage

Public profile now splits:

- **Scientific Claims** — existing cited summary/PK/safety text
- **Claim Sources** — `claim_sources` only (citations). Not automatic evidence A–F
- **Source References** — approved `source_substances` attachments **without** `claim_sources`. Traceability only. Not claim citations. No invented claims. No evidence upgrade

PMID 28237263-style approved rows without claim links appear under Source References, not as claim evidence.

## Dual Read

| Mode | Public UI | Admin |
|---|---|---|
| `legacy` | files only (`catalog.ts` + `published.json`) | no postgres fetch |
| `postgres` (production default) | postgres exclusive; full file fallback on timeout / network / RLS / query / invalid / partial | comparison still available |
| `dual` | **not mixed** — exclusive postgres, or exclusive file fallback | compares both |

Comparison statuses: MATCH, DIFFERENT, MISSING, EXTRA, UNRESOLVED, ORDER_ONLY, FORMAT_ONLY. No auto-repair.

EXTRA sources/studies/review actions (e.g. review-required queue vs published.json) are documented and **not critical**. MISSING public approved sources remain critical. Seed-vs-legacy with an extra review-required source is `DUAL_READ_READY`.

`publicLexiconMixesReads()` is always `false`.

## Fallback

Exclusive full legacy catalog on timeout, RLS, network, query, invalid JSON, or partial/empty identity response. Never mixes fields from both sources on one request.

## RLS

Policies still: research SELECT is `authenticated` (approved-only for non-admin) + admin write. `research_runs` / `review_actions` admin-only. No anon research SELECT policy.

**Not claimed as FULL JWT VERIFIED.** Label: **`RLS_VERIFIED_WITH_JWT_LIMITATION`** (no new GoTrue-signed JWT matrix this block).

Advisor noise includes pre-existing `admin_user_directory` / security definer view findings; not changed here.

## Research operations / community / official access

Reddit, BfArM, MHRA, NMPA remain **unavailable** (no scraping, no third-party stand-ins). Community kinds reddit/forum/blog/user-report cannot raise evidence, claims, or regulatory. `community_reports` = 0.

## Hudson / identity

NCT07487363 and NCT07437560: 0 sources, 0 studies live. Public filters still hide them.

Not merged: TB-500 / Thymosin Beta-4; Melanotan II / Afamelanotide; IGF-1 LR3 / Mecasermin; Glow Blend / component INNs; urinary hCG / Ovitrelle (`identityMustStaySeparate`).

## Tests

`npm test` **499 passed** / 41 files. Typecheck pass. Lint 0 errors / 5 existing react-refresh warnings. `npm run build` pass.

New: `src/tests/researchFinalHardening.test.ts`. Button lexicon headings updated to Claim Sources / Source References (tests not deleted).

## Security

Local production build: no `service_role`, no `BEGIN RSA PRIVATE`, no `sk_live` in `dist/`. Env names only.

## Shop / auth / calculator / mobile

Shop fingerprint **unchanged**: 320 products, 0 orders, `product_fp` `afd9f04bbf360fb5944709f30d653973`. Users **2**. Calculator logic not modified. Lexicon detail sections stack (no new horizontal layout). Hosted SPA not redeployed, so live UI still has the previous Sources heading until deploy.

## Production dump (Phase 29–30)

Location: `C:\Users\PolatMehmetErkan\Documents\PEPTIX-BACKUPS\` (not in git)

| File | Bytes | SHA-256 |
|---|---|---|
| `PEPTIX-PRODUCTION-FINAL-2026-08-29-1130-schema.sql` | 163 445 | `9dbdbdbc778d0c5cc6024d2292a2c53a9b53e9e9a8abab874a4b3228d0d7110a` |
| `PEPTIX-PRODUCTION-FINAL-2026-08-29-1130-data.sql` | 2 074 167 | `c731e6459564961c7853265d6f58823e40fb2b541047bf4608989b296e72b5f1` |
| `PEPTIX-PRODUCTION-FINAL-2026-08-29-1130.sql` | 2 239 390 | `78c018375ea5f9d0dbc7e5d9780ab79a4589b20c870bd9ca3586e657e259ec31` |

Full file re-hash matched. Size > 0. SQL header present (`SET statement_timeout`, UTF8). Schema includes `community_reports` and `research_connector_health` (0031). Data dump warned circular FKs on `research_runs` and `claims`. Isolated Docker restore **not** run. Dump includes auth schema data — keep offline; do not commit.

## Final fingerprint (live SELECT, no hardening SQL)

| | |
|---|---|
| Migration | 0031 (`research_operations`) |
| Substances | 27 |
| Sources | 616 (411 / 204 / 1) |
| Studies | 154 |
| Claims / evidence / regulatory | 294 / 294 / 41 |
| Review actions | 21 |
| Mappings | 93 |
| Products / orders / users | 320 / 0 / 2 |

Hudson sources/studies: 0. Community: 0. Runs: 5.

## Deploy

Hardening build is local (`dist/`). **Not deployed.** Production still serves the previous SPA until an explicit deploy is requested.

## Known limitations

1. **`RLS_VERIFIED_WITH_JWT_LIMITATION`** — no GoTrue JWT matrix this block.
2. Hosted SPA **does not yet include** the persist/citation/dual-read hardening until deploy.
3. Isolated Docker restore of the 1130 dump was not run.
4. Dump contains auth schema data; treat as confidential.
5. Reddit / BfArM / MHRA / NMPA unavailable (by design).
6. Dual Read EXTRA vs published.json is documented, not auto-repaired.
7. Lint react-refresh warnings; Vite chunk-size warning.

## STOP

No Batch 04. No new substances. No further production SQL. No commit. No push. No deploy.

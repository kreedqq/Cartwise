# Research Batch 03 Report

Access / last checked: **2026-08-29**  
Batch start: **2026-08-29T00:07:55.627Z**  
Batch end: **2026-08-29T00:13:43.217Z**  
Local run record: `src/research/cache/fetched/batch03/run.json`  
Production `research_runs`: **not written**.

This is a quality, recency, and coverage batch over the existing **27** identity substances. No new substances. No Batch 04. Community/Reddit remain unavailable. Production database and `published.json` were **not** mutated.

## Scope

| Item | Decision |
|---|---|
| Substances | Existing 27 identity slugs only |
| Production write | None |
| `published.json` | Unchanged (public exclusive fallback + seed parity) |
| New validated hits | `review-required` candidates in `src/research/cache/fetched/batch03/` |
| Evidence A–F overlays | Unchanged (27 approved overlays; 267 review-required remain) |
| Community | Unavailable; cannot raise evidence |
| Hudson | NCT07487363 and NCT07437560 unpublished; Hudson sponsor rejected |

Batch 01 and Batch 02 published overlays were **not** blindly re-compiled. Existing records were compared to a fresh official-API scan.

## Connectors queried

| Connector | Used | Result |
|---|---|---|
| ClinicalTrials.gov API v2 | Yes | Title + sponsor + identifier filters; intervention/condition captured |
| NCBI PubMed E-utilities | Yes | Retatrutide first call HTTP 500; retried 200 (93 hits) |
| openFDA Drugs@FDA | Yes | Orforglipron FOUNDAYO found; retatrutide/mazdutide no match |
| PubChem PUG | Yes | Identity lookup only |
| EMA EPAR HTTP | Yes | Known EPAR URLs + Foundayo/orforglipron/retatrutide/mazdutide/egrifta |
| BfArM | No | No supported API; unavailable |
| MHRA | No | No supported API; unavailable |
| NMPA | No | No supported English API; Mazdutide stays review-required |
| Reddit / forums / blogs | No | Unavailable; no scrape; no mock reports |

## Totals

| Metric | Count |
|---|---|
| Substances reviewed | 27 |
| Sources queried (cache rows: FDA check + trial hits + PubMed articles) | 723 |
| Sources accepted (validated, including already published) | 337 |
| Sources accepted already in `published.json` | 229 |
| Sources accepted **new, review-required only** | 108 |
| Sources rejected | 334 |
| Studies found (CT.gov totalCount sum) | 5339 |
| Studies already published and still valid in this scan | 90 |
| Studies validated **new, not published** | 36 |
| Studies rejected | 183 |
| Claims added | 0 |
| Claims updated | 0 |
| Evidence A–F changes | 0 |
| Regulatory status/region changes | 0 |
| Identity corrections | 0 |

Raw CT.gov totals include query pollution (especially somatropin, hCG, gonadorelin, semaglutide). Rejected hits are **not** published.

## Substances reviewed

| Substance | Evidence | Regulatory | `reviewStatus` | Latest scientific (PMID / date) | Latest validated trial | Last reviewed |
|---|---|---|---|---|---|---|
| retatrutide | B | clinical-development | review-recommended | 42250575 / 2026 Jun 13 | NCT06383390 2026-08-24 ACTIVE_NOT_RECRUITING | 2026-08-29 |
| tirzepatide | A | approved-specific US+EU | fresh | 39996356 / 2025 May | NCT07191873 2026-08-28 RECRUITING | 2026-08-29 |
| semaglutide | A | approved-specific US+EU | fresh | 40961952 / 2025 Nov | NCT07760948 2026-08-28 | 2026-08-29 |
| liraglutide | A | approved-specific US+EU | fresh | 39258838 / 2025 Feb 6 | NCT05965908 2026-08-25 COMPLETED | 2026-08-29 |
| cagrilintide | C | clinical-development | review-recommended | 42009015 / 2026 Jun | NCT07605052 2026-08-17 | 2026-08-29 |
| mazdutide | C | clinical-development | review-required | 41407860 / 2026 Apr | NCT07657676 2026-08-28 | 2026-08-29 |
| orforglipron | A | approved-specific **US only** | review-required | 41765029 / 2026 Mar 21 | NCT07790861 2026-08-27 | 2026-08-29 |
| tesamorelin | A | approved-specific **US only** | fresh | 42419889 / 2026 Jul 8 | NCT06554717 2026-05-19 | 2026-08-29 |
| cjc-1295 | C | investigational | fresh | 16352683 / 2006 Mar | — (no title-valid new NCT) | 2026-08-29 |
| ipamorelin | C | investigational | fresh | 42160466 / 2026 May 1 | NCT00672074 | 2026-08-29 |
| bpc-157 | D | investigational | fresh | 41490200 / 2026 Jan 1 | NCT02637284 | 2026-08-29 |
| tb-500 | F | insufficient | review-required | 41490200 / 2026 Jan 1 | none published | 2026-08-29 |
| ghk-cu | D | insufficient | review-required | 41490200 / 2026 Jan 1 | none (X39/Hudson excluded) | 2026-08-29 |
| mots-c | D | investigational | review-required | 42640735 / 2026 Aug 25 | Hudson NCT07505745 rejected | 2026-08-29 |
| aod-9604 | E | investigational | review-recommended | 24976118 / 2014 Sep | 0 CT.gov | 2026-08-29 |
| sermorelin | C | investigational | review-recommended | 8772599 / 1996 Mar | title filter still thin | 2026-08-29 |
| thymosin-beta-4 | C | clinical-development | review-recommended | 41570941 / 2026 Jan | NCT03937882 2026-08-28 COMPLETED | 2026-08-29 |
| semax | C | investigational | review-recommended | 29798983 / 2018 | 0 CT.gov | 2026-08-29 |
| selank | C | investigational | review-recommended | 29787664 / 2016 | CT.gov noise unpublished | 2026-08-29 |
| thymosin-alpha-1 | C | clinical-development | review-required | 41373628 / 2025 Nov 27 | NCT07780721 | 2026-08-29 |
| kpv | D | investigational | fresh | 39252648 / 2024 Dec | 0 CT.gov | 2026-08-29 |
| igf-1-lr3 | F | investigational | review-recommended | — (LR3-specific still thin) | 0 CT.gov | 2026-08-29 |
| somatropin | A | approved-specific US+EU | fresh | 35405011 / 2022 Jun 16 | NCT07221851 2026-08-19 | 2026-08-29 |
| hcg | A | approved-specific **US only** | review-recommended | 19072445 / 2008 Jan | NCT07771283 2026-08-27 | 2026-08-29 |
| gonadorelin | E | insufficient | review-required | — (title filter) | 1332 raw hits unpublished | 2026-08-29 |
| melanotan-ii | F | investigational | review-recommended | 32674774 / 2020 Aug 15 | Hudson NCT07437560 rejected | 2026-08-29 |
| glow-blend | F | insufficient | fresh | blend, not an INN | no unique trial search | 2026-08-29 |

## Sources accepted / rejected

Accepted new rows are **review-required candidates**, not public lexicon rows.

Rejected examples:

| Source | Reason | Date |
|---|---|---|
| NCT07487363 | Hudson exclusion (TB-500 fictional-cluster NCT) | 2026-08-29 |
| NCT07437560 | Hudson exclusion (melanotan-ii) | 2026-08-29 |
| NCT07437547, NCT07437586, NCT07505745, NCT07467447 | Hudson Biotech sponsor | 2026-08-29 |
| NCT07226947 on retatrutide | Title is GLP-1 exercise protocol; no retatrutide/LY3437943 | 2026-08-29 |
| Selank / gonadorelin / sermorelin CT.gov titles without INN | Query pollution | 2026-08-29 |
| Sheep/rumen IGF-1 style titles | Identity filter (IGF-1 LR3 ≠ mecasermin / unrelated IGF) | 2026-08-29 |

## Studies found / published / rejected

- **Found:** 5339 CT.gov `totalCount` across 26 fetched slugs (glow-blend not queried as INN).
- **Published in this batch:** 0. Existing 118 Postgres / published studies unchanged.
- **New validated, held for review:** 36 title-matched NCTs (retatrutide Phase 3 updates, orforglipron PK/DDI, mazdutide IBI362, cagrilintide, etc.).
- **Rejected:** 183 (title/identity  + Hudson + mock).

Retatrutide remains **not approved**. New Phase 3 NCTs (e.g. NCT07357415, NCT07232719, NCT06260722, NCT06859268) do not change regulatory status.

## Claims / evidence / regulatory / identity

| Field | Change |
|---|---|
| Claims added | 0 — no new public claim without a published source ID |
| Claims updated | 0 |
| Evidence A–F | Unchanged. Community did not raise evidence. Preclinical did not become human evidence. |
| 267 review-required assessments | **Not auto-approved.** New scan did not supply a primary-source basis to flip any overlay. |
| Regulatory enums/regions | Unchanged |
| Identity | TB-500 ≠ Thymosin Beta-4; Melanotan II ≠ afamelanotide; IGF-1 LR3 ≠ mecasermin; glow-blend = blend |

### Orforglipron / FOUNDAYO / NDA220934

- Drugs@FDA still matches **FOUNDAYO**.
- EMA `/EPAR/foundayo` and `/EPAR/orforglipron` still **HTTP 404**.
- BfArM / MHRA / NMPA: unavailable (no supported API).
- Status stays **approved-specific, US only**. EMA remains **review-required**, not guessed as not-approved.

### Retatrutide

- Drugs@FDA: no match (HTTP 404 “No matches found!”).
- EMA `/EPAR/retatrutide`: 404.
- Phase 2/3 programmes continue (TRIUMPH-Outcomes NCT06383390 last update 2026-08-24).
- Status stays **clinical-development**. Not represented as approved.

### Tesamorelin / Egrifta EMA

- `https://www.ema.europa.eu/en/medicines/human/EPAR/egrifta` is HTTP 200.
- Page is a **2012 withdrawn MAA** (Ferrer; tesamorelin), not an EU marketing authorisation.
- **Do not** add EU to tesamorelin `regulatoryRegions`. US FDA EGRIFTA remains the sourced approval.

### hCG / Ovitrelle

- Ovitrelle EPAR still HTTP 200 (choriogonadotropin alfa).
- Urinary hCG US label vs recombinant alfa remains **UNRESOLVED** (`hcg:ema-ovitrelle`). Not merged.

### Semaglutide DailyMed

- `semaglutide:fda-semaglutide-27f15fac` remains **UNRESOLVED**. Title/product/NDA not forced together.

## Review required (still)

| Item | Status after Batch 03 |
|---|---|
| Mazdutide NMPA primary | Still secondary literature only; EMA 404; FDA no match |
| Orforglipron EMA/BfArM/MHRA | EMA Foundayo 404; other agencies unavailable |
| Hudson cluster | Still excluded from publication |
| GHK-Cu X39 / patch | Still excluded as GHK-Cu administration |
| Zadaxin / thymosin-alpha-1 non-US label | Still no primary label in this scan |
| Gonadorelin title-restricted literature | Still noisy; review-required |
| 267 evidence assessments | Still review-required |
| 108 new accepted sources / 36 new studies | Review-required; not public |

## Community status

**Unavailable.** No Reddit scraping. No mock forum/blog reports. Community cannot change scientific evidence, regulatory status, or safety classification.

## Hudson exclusions

Unpublished: **NCT07487363**, **NCT07437560**. Raw Batch 03 cache still contains the CT.gov hits (same policy as Batch 01/02 historical cache). Compile/public/Postgres remain clean.

## Unresolved issues (not guessed)

- `hcg:ema-ovitrelle`
- `semaglutide:fda-semaglutide-27f15fac`
- Shop mapping: BT*, MT1, KL80, multi-INN blends, fragments, amides
- BfArM / MHRA / NMPA primary connectors
- 267 claim-level evidence assessments

## Last reviewed

Scan date **2026-08-29** for all 27 slugs. Published overlay `lastReviewedAt` remains **2026-08-28** until an admin-approved compile/import.

## Production inventory (unchanged, live cartwise-prod)

27 substances, 412 sources, 118 studies, 294 claims, 294 evidence, 41 regulatory, 19 review actions, 93 product mappings.

## Tests / gates

Recorded in `docs/PROJECT_STATE.md` after the post-batch run. New tests: `src/tests/researchBatch03.test.ts`.

## Verdict

**RESEARCH_BATCH_03_COMPLETE_WITH_REVIEW**

The recency/coverage scan completed with official APIs. New hits are held for admin review. Public lexicon, production research tables, and `published.json` are unchanged. Unresolved identity/regulatory items were not guessed.

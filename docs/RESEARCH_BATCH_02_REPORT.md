# Research Batch 02 Report

Access / last checked: **2026-08-28**  
Batch start: 2026-08-28  
Batch end: 2026-08-28  
Backup commit before this batch: `d09a29ac3d14ef2c91fd711c2157d4cd94895479`  
Consistency check: 2026-08-28 (exclusive status counting documented; no new research).

Research lives in the client catalog + `published.json`, not in Postgres substance tables. Shop products remain separate.

## Inventory (code is source of truth)

| Bucket | Count | Notes |
|---|---|---|
| Identity catalog (`PEPTIDE_SUBSTANCES_IDENTITY`) | 27 | All slugs |
| Published Batch 01 (left unchanged except recompile) | 15 | Not re-researched |
| Batch 02 scope (identity / incomplete) | 12 | See table below |
| Identity-only leftover after Batch 02 | 0 | All 27 slugs now have a published overlay |

Shop mapping (prefix/name in `src/lib/peptide/search.ts`): Batch 01 prefixes unchanged. Batch 02 prefixes already present: `MT2` → melanotan-ii, `KPV` → kpv, `IGF` → igf-1-lr3. Glow blends map by name (`GHK` + `TB` + `BPC`) to `glow-blend`, not to a fake INN.

Priority applied: shop-mapped (melanotan-ii, kpv, igf-1-lr3, glow-blend) → approved hormones (somatropin, hcg) → human trials (thymosin-beta-4, thymosin-alpha-1) → historical/investigational (sermorelin, semax, selank) → noisy remainder (gonadorelin).

## Connectors

Used: ClinicalTrials.gov v2, NCBI PubMed E-utilities, openFDA Drugs@FDA, PubChem PUG, openFDA labels, EMA EPAR HTTP HEAD/GET.  
Not used: BfArM, MHRA, Reddit (unavailable; no scraping).

## Substance summary

Two layers (see `docs/ARCHITECTURE.md`):

- **Code:** `reviewStatus` on the published profile (`fresh` / `review-recommended` / `review-required`). Not the same field as completeness.
- **Exclusive primary status** (this report, 12 unique rows): Review Required if `review-required`, else Partial if the validated file is thin/noisy, else Research Complete. `review-recommended` is not Review Required.

The earlier 9+2+2=13 total double-counted **gonadorelin** (Partial quality **and** `review-required`). Exclusive total is **12**.

| Substance | Exclusive status | Code `reviewStatus` | Evidence | Regulatory | Sources | Studies |
|-----------|------------------|---------------------|----------|------------|---------|---------|
| sermorelin | Research Complete | review-recommended | C | investigational | 6 | 0 |
| thymosin-beta-4 | Research Complete | review-recommended | C | clinical-development | 22 | 12 |
| semax | Research Complete | review-recommended | C | investigational | 11 | 0 |
| selank | Research Complete | review-recommended | C | investigational | 9 | 0 |
| kpv | Research Complete | fresh | D | investigational | 7 | 0 |
| somatropin | Research Complete | fresh | A | approved-specific (US, EU) | 14 | 1 |
| hcg | Research Complete | review-recommended | A | approved-specific (US) | 9 | 2 |
| melanotan-ii | Research Complete | review-recommended | F | investigational | 8 | 0 |
| glow-blend | Research Complete | fresh | F | insufficient | 5 | 0 |
| igf-1-lr3 | Partial | review-recommended | F | investigational | 4 | 0 |
| thymosin-alpha-1 | Review Required | review-required | C | clinical-development | 26 | 10 |
| gonadorelin | Review Required | review-required | E | insufficient | 4 | 0 |

**gonadorelin:** exclusive status is Review Required. The scientific file is also thin (query noise); that is a quality note, not a second inventory count.

**thymosin-alpha-1:** exclusive status is Review Required (Zadaxin/non-US without a primary label). Sources/studies are otherwise workflow-complete; it is not Partial.

Research Complete means the defined workflow ran and claims are cited. It does **not** mean every paper worldwide was found.

Partial means the workflow ran but title-validated substance-specific literature/trials remain too thin to treat the scientific file as complete (and `reviewStatus` is not `review-required`).

## Totals (Batch 02 only)

| Metric | Value |
|---|---|
| Substances processed | 12 |
| Exclusive Research Complete | 9 |
| Exclusive Partial | 1 (igf-1-lr3) |
| Exclusive Review Required | 2 (thymosin-alpha-1, gonadorelin) |
| Exclusive total | 12 |
| Code `review-recommended` (not an exclusive bucket) | 7 |
| Code `fresh` | 3 (kpv, somatropin, glow-blend) |
| Published sources (Batch 02 overlays) | 125 |
| Published NCT studies | 25 |
| Community | Unavailable for all 12 |

Raw connector hits are larger than published rows. Title/sponsor filters dropped noise (especially gonadorelin 1331 CT.gov hits, selank 10 false CT.gov hits, sermorelin GHRH pollution, Hudson records).

### Sources rejected (examples)

| Source | Reason | Date |
|---|---|---|
| NCT07437560 | Hudson Biotech; same exclusion class as fictional TB-500 example cluster | 2026-08-28 |
| NCT07487363 on thymosin-beta-4 | Hudson Biotech / TB-500 fragment example | 2026-08-28 |
| Selank CT.gov titles without “selank” | Substring noise | 2026-08-28 |
| Gonadorelin CT.gov/PubMed cache titles without gonadorelin/Factrel/Lutrelef | Query pollution | 2026-08-28 |
| PMID 22227200 | Sheep rumen IGF-1, not IGF-1 LR3 | 2026-08-28 |
| PubChem CID 1108 on hcg | Wrong compound for chorionic gonadotropin | 2026-08-28 |
| EMA `/EPAR/lutrelef` | HTTP 404 | 2026-08-28 |
| EMA `/EPAR/norditropin` | HTTP 404 (Omnitrope EPAR used for EU somatropin) | 2026-08-28 |

Raw caches still contain rejected CT.gov rows; they are not in `published.json`.

## Regulatory updates

- **Somatropin:** FDA labels Norditropin, Omnitrope, Serostim. EMA Omnitrope EPAR HTTP 200. Regions **US, EU**. Not global approval for every brand URL.
- **hCG:** FDA DailyMed chorionic gonadotropin (BLA017067), including explicit **non-indication for obesity**. Region **US** only. EMA Ovitrelle (choriogonadotropin alfa) stored as related, not merged.
- **Sermorelin, thymalfasin, gonadorelin:** Drugs@FDA no match → **insufficient / investigational**, not “not approved”.
- Batch 01 Foundayo EMA URL still 404 (unchanged policy: US-only orforglipron).

## Identity corrections

- TB-500 remains distinct; Thymosin Beta-4 now has its own sourced profile (C / clinical-development).
- Melanotan II ≠ afamelanotide/Scenesse.
- IGF-1 LR3 ≠ mecasermin/Increlex.
- Glow blend is a product blend mapped to GHK-Cu + TB-500 + BPC-157.
- hCG urinary vs recombinant alfa flagged as **Conflicting Evidence** (identity), not auto-merged.
- HCG PubChem CID 1108 dropped.

## Evidence changes (identity F → overlay)

See summary table. Community did not raise any evidence level.

## Conflicts

- hCG: urinary chorionic gonadotropin (US label) vs recombinant choriogonadotropin alfa (Ovitrelle EPAR).

## Community status

Reddit / forums / blogs: **unavailable**. No anecdotal quotes published. `communityCannotRaiseEvidence` unchanged.

## Batch 01

Not re-researched. Recompile kept prior evidence/regulatory values. Hudson/misassigned NCT exclusions remain.

## Tests / gates

Recorded in `docs/PROJECT_STATE.md` after the post-batch run.

## Follow-up (not Batch 03)

Do not auto-start Batch 03. Optional later: title-restricted gonadorelin PubMed, primary Zadaxin/non-US thymalfasin label, Mazdutide NMPA (Batch 01), Orforglipron EMA.

# Research Batch 01 Quality Audit

Audit Date: **2026-08-28**  
Auditor method: code + compiled `published.json` + official APIs (ClinicalTrials.gov v2, NCBI E-utilities, DailyMed/openFDA cache, EMA EPAR URLs).  
This is **not** Research Batch 02. No new substances were added. Community/Reddit remain unavailable.

## Totals

| Metric | Count |
|---|---|
| Substances audited | 15 |
| Sources audited | 343 (after correction compile) |
| Studies audited | 98 published NCT records (after filters) |
| Claims audited | 164 cited scientific statements |
| Claims corrected | 8 (TB-500, MOTS-c, GHK-Cu, Mazdutide unknowns) |
| Evidence levels changed | 0 |
| Regulatory status enum changed | 0 (regions added; status labels unchanged) |
| Identity issues corrected | 3 |
| Source issues corrected | 6 published-study misassignments + search-count classification |
| Duplicate identifier issues | 0 in published profiles |
| Review items | 8 (5 High/Medium required, 3 recommended) |
| Unresolved (not guessed) | 6 |

All published scientific statements remain source-ID-cited. Community cannot raise evidence. No mock studies remain in published study lists.

## Substance audit table

| Substance | Evidence Before | Evidence After | Regulatory Before | Regulatory After | Sources | Issues | Review |
|-----------|-----------------|----------------|-------------------|------------------|---------|--------|--------|
| Retatrutide | B | B | clinical-development | clinical-development (no region) | 28 | Phase-3 recency; not approved | review-recommended |
| Tirzepatide | A | A | approved-specific | approved-specific **US, EU** | 30 | none material | fresh |
| Semaglutide | A | A | approved-specific | approved-specific **US, EU** | 32 | CT.gov 12-cap includes class-adjacent trials | fresh |
| Liraglutide | A | A | approved-specific | approved-specific **US, EU** | 32 | CT.gov 12-cap includes class-adjacent trials | fresh |
| Tesamorelin | A | A | approved-specific | approved-specific **US** | 26 | Removed GHRH-MCI NCT02553603 | fresh |
| Orforglipron | A | A | approved-specific | approved-specific **US only** | 28 | EMA not checked | review-required |
| Cagrilintide | C | C | clinical-development | clinical-development | 28 | Possible future B | review-recommended |
| Mazdutide | C | C | clinical-development | clinical-development (not global approved) | 28 | NMPA reported in secondary literature only | review-required |
| CJC-1295 | C | C | investigational | investigational | 17 | limited human data (kept C) | fresh |
| Ipamorelin | C | C | investigational | investigational | 18 | Removed NCT07717866 (ibogaine/5-MeO-DMT) | fresh |
| BPC-157 | D | D | investigational | investigational | 17 | Hudson NCT in cache, not published | fresh |
| GHK-Cu | D | D | insufficient | insufficient | 16 | X39 patch is not GHK-Cu administration | review-required |
| MOTS-c | D | D | investigational | investigational | 16 | Hudson NCT + biomarker NCT excluded | review-required |
| AOD-9604 | E | E | investigational | investigational | 14 | 0 CT.gov ≠ proof of no human studies | review-recommended |
| TB-500 | F | F | insufficient | insufficient | 13 | NCT07487363 is a fictional CT.gov example | review-required |

## Source problems

| Source | Type | Substance | Valid | Issue | Action |
|--------|------|-----------|-------|-------|--------|
| NCT07487363 | clinical_trial | TB-500 | No (self-described fictional example) | Brief Summary: “This fictional study is an example of a ClinicalTrials.gov-style record.” Sponsor Hudson Biotech | Removed from published studies/sources; kept in raw cache; Review Required |
| NCT07505745 | clinical_trial | MOTS-c | Not used as evidence | Same Hudson Biotech / Shenzhen contact cluster as the fictional TB-500 record | Not published as a study; Review Required |
| NCT07437547 | clinical_trial | BPC-157 | Not published | Hudson Biotech cluster in cache | Filtered by sponsor; cache retained |
| NCT07437586 | clinical_trial | GHK-Cu | Not published | Hudson Biotech cluster in cache | Filtered by sponsor; cache retained |
| NCT07467447 | clinical_trial | Retatrutide | Not published | Hudson Biotech cluster in cache | Filtered by sponsor; cache retained |
| NCT07481734 | clinical_trial | Tesamorelin | Not published | Title contains “(Mock Study)” | Already excluded by mock filter |
| NCT07706361 | clinical_trial | GHK-Cu | Misassigned | X39 Patch measures circulating GHK; not GHK-Cu peptide administration | Removed from published studies |
| NCT07717866 | clinical_trial | Ipamorelin | Misassigned | Ibogaine / 5-MeO-DMT / MeRT veterans study | Removed (title must contain ipamorelin) |
| NCT02553603 | clinical_trial | Tesamorelin | Misassigned | Generic GHRH for MCI; intervention is not tesamorelin | Removed |
| NCT04027712 | clinical_trial | MOTS-c | Misassigned | Observational MOTS-c **biomarker**, not MOTS-c intervention | Removed |
| ct-count-* / pm-count-* | search log | all | Valid as search documentation | Previously typed as clinical_trial/pubmed quality 5 | Reclassified `scientific` quality 3 |
| PMID 41028652 | review | Mazdutide | Valid PubMed record | Secondary “First Approval” article, not NMPA primary | Added as source; does **not** change regulatory enum |

Live API check (2026-08-28): all remaining published PMIDs and NCT IDs returned HTTP 200 from NCBI / ClinicalTrials.gov. FDA labels in cache for tirzepatide, semaglutide, liraglutide, tesamorelin, orforglipron (FOUNDAYO NDA220934, DailyMed setid `8ac446c5-feba-474f-a103-23facb9b5c62`, label effective_time 20260729) match the published claims. EMA EPAR URLs for Ozempic, Wegovy, Mounjaro, Victoza, Saxenda were already HTTP-checked on 2026-08-28.

## Identity

| Substance | Finding |
|---|---|
| Retatrutide = LY3437943 | Confirmed in catalog + Phase-2/3 records. Not FDA-approved. |
| Orforglipron = LY3502970 = FOUNDAYO | Confirmed. Development name added to identity catalog. Small-molecule, not peptide. |
| Mazdutide = IBI362 / LY3305677 | Development names added. China NMPA **not** asserted as regulatory status. |
| TB-500 ≠ Thymosin Beta-4 | Kept separate. CAS 885340-08-9 / PubChem CID 62707662 retained. Fictional NCT no longer used as identity proof. |

## Evidence

No evidence level was auto-changed. 0 CT.gov hits is not “no human studies.” Missing FDA rows are not “not approved.”

- **A** remains for FDA-labeled products (tirzepatide, semaglutide, liraglutide, tesamorelin, orforglipron US).
- **B** remains for retatrutide (published Phase 2 + Phase 3 TRANSCEND-T2D-1 PMID 42250575; no approval).
- **C** remains for limited human programs (cagrilintide, mazdutide, CJC-1295, ipamorelin).
- **D** remains for predominantly preclinical (BPC-157, GHK-Cu, MOTS-c).
- **E** remains for AOD-9604 (sparse/older literature; 0 CT.gov for AOD9604).
- **F** remains for TB-500 (no adequate human safety/efficacy data).

## Regulatory

| Substance | Audited status | Region stored |
|---|---|---|
| Tirzepatide | approved-specific (Mounjaro/Zepbound FDA; Mounjaro EMA EPAR) | US, EU |
| Semaglutide | approved-specific (Ozempic FDA; Ozempic/Wegovy EMA) | US, EU |
| Liraglutide | approved-specific (FDA labels; Victoza/Saxenda EMA) | US, EU |
| Tesamorelin | approved-specific (EGRIFTA FDA); EMA not in this batch | US |
| Orforglipron | approved-specific FOUNDAYO NDA220934 **US**; EMA unknown | US |
| Retatrutide | clinical-development; Drugs@FDA no match; no EMA EPAR in batch | — |
| Others | investigational / insufficient as before | — |

Mazdutide: PMID 41028652 reports China NMPA first approval. That is **not** a regulatory-authority source. Status stays `clinical-development`. Review Required High.

## Pharmacology / safety / reconstitution / community

- Pharmacology arrays remain empty: no unsourced numeric PK.
- Safety items keep human vs animal vs theoretical domains (GLP-1 boxed warnings stay animal/theoretical where the label says so).
- Experimental substances keep “Keine standardisierte regulatorisch validierte Rekonstitutionsanweisung identifiziert.”
- Approved injectables/orals point to labels, not research-vial recipes.
- Community: unavailable. Reddit connector still unavailable. No mock community data.

## Correction log

| Substance | Field | Old value | New value | Reason | Source | Date |
|---|---|---|---|---|---|---|
| TB-500 | studies/sources NCT07487363 | published as trial | removed from published | Self-described fictional CT.gov example | CT.gov NCT07487363 briefSummary | 2026-08-28 |
| TB-500 | summary + identityNote | treated NCT as fragment study | states record is fictional | Same | CT.gov | 2026-08-28 |
| MOTS-c | NCT07505745 | pinned current research | not published as study | Hudson cluster / unverified | CT.gov + cluster | 2026-08-28 |
| MOTS-c | NCT04027712 | published | removed | Biomarker, not intervention | CT.gov title | 2026-08-28 |
| GHK-Cu | NCT07706361 | published | removed | X39 patch, not GHK-Cu drug | CT.gov | 2026-08-28 |
| Ipamorelin | NCT07717866 | published | removed | Wrong intervention | CT.gov | 2026-08-28 |
| Tesamorelin | NCT02553603 | published | removed | Generic GHRH, not tesamorelin | CT.gov | 2026-08-28 |
| Orforglipron | regulatoryRegions | none | US | Approval is US-specific | FDA/DailyMed FOUNDAYO | 2026-08-28 |
| Tirzepatide/Semaglutide/Liraglutide | regulatoryRegions | none | US, EU | FDA labels + EMA EPARs | Labels / EMA | 2026-08-28 |
| Tesamorelin | regulatoryRegions | none | US | FDA only in this batch | EGRIFTA label | 2026-08-28 |
| Mazdutide | source PMID 41028652 | absent | added, review-required | Secondary NMPA report | PubMed 41028652 | 2026-08-28 |
| Orforglipron | catalog developmentNames | [] | LY3502970 | Confirmed identity | FDA label / CT.gov | 2026-08-28 |
| Mazdutide | catalog developmentNames | [] | IBI362, LY3305677 | Confirmed aliases | PubMed | 2026-08-28 |
| Search-count sources | sourceType/quality | clinical_trial/pubmed 5 | scientific 3 | Not primary studies | compile contract | 2026-08-28 |

## Review Required (admin queue)

| Substance | Issue | Priority | Source |
|---|---|---|---|
| Mazdutide | China NMPA status needs a primary NMPA/regulatory source before any regional approved status | High | PMID 41028652 (secondary) |
| Orforglipron | EMA/BfArM/MHRA status for FOUNDAYO not checked | High | FDA FOUNDAYO only |
| TB-500 | Fictional NCT07487363 must not re-enter published studies | High | CT.gov |
| MOTS-c | Hudson NCT07505745 not independently confirmed | High | CT.gov cluster |
| GHK-Cu | Do not treat biomarker/patch studies as GHK-Cu administration | Medium | NCT07706361 |
| Retatrutide | Phase-3 recency vs still not approved | Medium | PMID 42250575, Drugs@FDA none |
| Cagrilintide | Evidence C vs possible B after more Phase-3 publications | Medium | PMID 34798060, NCT07220642 |
| AOD-9604 | 0 CT.gov hits under AOD9604; older human literature may exist under other terms | Low | ct-count + PMID 15134286 |

## Confidence

High for FDA-labeled products and for “retatrutide is not approved.”  
Moderate for C/D investigational peptides.  
Low/insufficient for TB-500 human safety.  
Uncertain items are marked Review Required rather than invented.

## Remaining known list-quality issue (not auto-fixed)

Approved GLP-1 study lists are capped at 12 CT.gov hits and can include class-adjacent protocols (e.g. other GLP-1s, device/exercise companions). Claims do not treat every listed NCT as an approved indication. Tightening the 12-cap ranking is optional later work, not Batch 02.

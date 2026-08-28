# Snapshot: Research Batch 01 audited

Date: 2026-08-28

## Research Batch 01

15 curated substances in `src/lib/peptide/profiles/published.json` (access date 2026-08-28). Raw API cache unchanged in `src/research/cache/fetched/` except that published compilation now excludes fictional/misassigned trials.

## Audit date

2026-08-28

## Audited substances

Retatrutide, Tirzepatide, Semaglutide, Liraglutide, Tesamorelin, Orforglipron, Cagrilintide, Mazdutide, CJC-1295, Ipamorelin, BPC-157, GHK-Cu, MOTS-C, AOD-9604, TB-500.

## Source count

343 published sources after audit compile.

## Study count

98 published NCT records after filters (was higher; fictional Hudson and misassigned records removed from publication, not from cache).

## Evidence status

Unchanged: A (5 approved-label products), B retatrutide, C (4), D (3), E AOD-9604, F TB-500.

## Regulatory status

Unchanged enums. Regions now stored: tirzepatide/semaglutide/liraglutide US+EU; tesamorelin US; orforglipron US. Mazdutide not marked approved.

## Community status

Unavailable. No Reddit scraping. No mock community reports.

## Corrections

Fictional NCT07487363 excluded from TB-500 publication. Hudson Biotech cluster excluded. Ipamorelin ibogaine NCT, tesamorelin generic-GHRH NCT, GHK X39 patch, MOTS-c biomarker NCT removed from published lists. Search-count sources reclassified. Development names added for orforglipron and mazdutide. PMID 41028652 added as secondary Mazdutide source.

## Review required

8 items in published `reviewItems` and Admin Research queue (mazdutide NMPA, orforglipron EMA, TB-500 fictional NCT, MOTS-c Hudson, GHK-Cu X39, plus three recommended recency/evidence items).

## Test status

280 passed / 23 files.

## Build status

Typecheck pass. Lint 0 errors, 5 pre-existing react-refresh warnings. Production build pass.

## Known issues

- Peptide research still file-based, not Postgres.
- Browser connectors remain unavailable.
- BfArM/MHRA not queried.
- GLP-1 CT.gov 12-cap lists can include class-adjacent studies.
- Nested `Cartwise/` gitlink must stay untouched.

## Next recommended step

Wait for the next user assignment. Do **not** start Batch 02, do not enable Reddit, do not add substances.

# Snapshot: Research Batch 02

Date: 2026-08-28

## Batch status

**Complete** for the 12 substances that were identity-only / incomplete after Batch 01. Batch 03 was **not** started. No git commit/push.

Pre-batch backup: `d09a29ac3d14ef2c91fd711c2157d4cd94895479`

## Substances

Catalog: 27 identity records. Published overlays: 27 (15 Batch 01 unchanged in evidence policy + 12 Batch 02).

Batch 02: sermorelin, thymosin-beta-4, semax, selank, thymosin-alpha-1, kpv, igf-1-lr3, somatropin, hcg, gonadorelin, melanotan-ii, glow-blend.

Status (exclusive primary, 12 unique): 9 Research Complete, 1 Partial (igf-1-lr3), 2 Review Required (thymosin-alpha-1, gonadorelin). Gonadorelin is not counted twice: `review-required` wins over Partial quality. Code field is `reviewStatus`; Completeness/Partial is report-only (see ARCHITECTURE).

## Sources

Batch 02 published sources: 125. Total published.json sources ≈ Batch 01 343 + 125. Search-count rows remain `scientific`. HCG PubChem CID 1108 not published.

## Studies

Batch 02 published NCTs: 25. Hudson NCT07437560 (melanotan-ii) and NCT07487363 (TB-500 fragment on TB4 query) excluded from publication. Selank CT.gov noise unpublished. Gonadorelin 1331 raw hits unpublished (no title match).

## Evidence

A: somatropin, hCG (plus Batch 01 approved labels).  
C: sermorelin, thymosin-beta-4, semax, selank, thymosin-alpha-1.  
D: kpv.  
F: igf-1-lr3, melanotan-ii, glow-blend.  
TB-500 remains F and distinct from thymosin-beta-4 (now C).

## Regulatory

Somatropin approved-specific US+EU (Omnitrope EPAR 200; Norditropin EPAR URL 404).  
hCG approved-specific US; Ovitrelle related recombinant not merged; EU not claimed for urinary hCG.  
Others: investigational / clinical-development / insufficient — no invented “not approved”.

## Community

Unavailable. No Reddit scrape. Community does not raise evidence.

## Review required

Admin queue includes Batch 02 items (Zadaxin/non-US TA-1, gonadorelin noise, RGN-259 vs TB-500, Ovitrelle identity, historical Geref, IGF ≠ mecasermin, Hudson MT-II). Batch 01 items (Mazdutide NMPA, Orforglipron EMA) remain.

## Known issues

- Peptide research still file-backed (no Postgres substances)
- Browser connectors unavailable
- `published.json` main chunk size grows (27 profiles)
- GENXELL Excel still not in repo
- Numeric PK not copied from labels

## Test status

283 passed / 23 files (`npm test`). Typecheck pass. Lint 0 errors, 5 existing react-refresh warnings.

## Build status

`npm run build` pass (Vite chunk-size warning; catalog chunk ~348 kB).

## Report

`docs/RESEARCH_BATCH_02_REPORT.md`

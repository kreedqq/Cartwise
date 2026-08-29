# Final release QA

**Verdict (pre-deploy of this commit): platform ready pending hosted SPA + JWT limitation.**  
After live production QA this file’s backup copy is updated under `Documents\PEPTIX-BACKUPS\`.

Date: 2026-08-29. Production DB: **cartwise-prod** `cnjrjinvxycdkrmzcime` migration **0031**.

No Batch 04. No production SQL in this finalization. No push.

## Backup

Folder: `C:\Users\PolatMehmetErkan\Documents\PEPTIX-BACKUPS\PEPTIX-FULL-BACKUP-FINAL-2026-08-29-1143`

| Artifact | Bytes | SHA-256 (re-hashed match) |
|---|---|---|
| `PEPTIX-SOURCE-FINAL-2026-08-29-1143.zip` | 4 755 725 | `ab0879921f524f01dd7610dbf28635c5d2a3b31a86c888f555724946bfe2d5b4` |
| `PEPTIX-PRODUCTION-0031-FINAL-2026-08-29-1143.sql` | 2 220 960 | `32ebd1db5430f5b9aede9cf19f9c980a0988ab78fc956b3919d245c571684b37` |

ZIP includes `.git`, excludes `node_modules`, `dist`, `.env.local`. SQL is schema + **public** data (`encrypted_password` = 0). Isolated Docker restore not run. Secret scan: no live secrets.

Measured fingerprint: migration `20260829082116`; 27 substances; 616 sources (411/204/1); 154 studies; 294 claims; 294 evidence; 41 regulatory; 21 review actions; 93 mappings; 320 products; fp `afd9f04bbf360fb5944709f30d653973`; 6 carts; 0 orders; 2 users; user_fp `76af77941b50c8bc6ff620fc81e9ac50`; Hudson 0.

## Git / tests (before commit)

HEAD was `5e38cf1` on dirty `main`. Typecheck pass. Lint 0 errors / 5 warnings. Tests **499** passed. Build pass.

## Hardening in this commit

- UNCHANGED/DUPLICATE do not rewrite `review_status`
- NEW → review-required; scientific UPDATED → review-required + diff
- Claim Sources vs Source References
- Dual Read exclusive modes; extras documented, not mixed
- Reddit/BfArM/MHRA/NMPA unavailable

## RLS

**RLS_VERIFIED_WITH_JWT_LIMITATION** — no GoTrue JWT matrix this pass.

## Connectors

Available: PubMed, ClinicalTrials.gov, FDA, EMA (cache-backed in SPA).  
Unavailable: BfArM, MHRA, NMPA, Reddit. No scraping.

## Shop / auth

320 products, 0 orders, 2 users. Fingerprints unchanged at backup time.

Calculator logic unchanged. Community empty.

## STOP

No Batch 04. No further production SQL. No push.

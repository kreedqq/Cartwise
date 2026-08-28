# Changelog

Only material changes. Dates are local project days.

## 2026-08-28

### Added

- Research Batch 02: 12 remaining identity substances compiled into `published.json` (sermorelin, thymosin-beta-4, semax, selank, thymosin-alpha-1, kpv, igf-1-lr3, somatropin, hcg, gonadorelin, melanotan-ii, glow-blend)
- Report `docs/RESEARCH_BATCH_02_REPORT.md` and snapshot `docs/snapshots/2026-08-28-research-batch-02.md`
- Title/sponsor filters for noisy Batch 02 CT.gov/PubMed queries; glow-blend mapping-only profile

### Changed

- All 27 catalog slugs now have a published overlay; identity defaults remain F until overlay
- Batch 02 exclusive research-status counting: 9 Complete + 1 Partial + 2 Review Required = 12 (`reviewStatus` is orthogonal; gonadorelin is not counted twice)
- Fetch scripts accept `batch01` / `batch02` / `all`

### Fixed

- Excluded Hudson NCT07437560 from Melanotan II publication; skipped wrong HCG PubChem CID 1108 and sheep IGF-1 PMID 22227200

### Research

- Somatropin US+EU labels/EPAR; hCG US label with obesity non-indication; TB4 kept distinct from TB-500 with own C-level profile
- Community still unavailable

### Added (earlier this day)

- Project memory docs: `PROJECT_STATE.md`, `ARCHITECTURE.md`, `TODO.md`, this changelog, snapshot `docs/snapshots/2026-08-28-peptide-platform.md`, Cursor rule `.cursor/rules/project-memory.mdc`
- Independent peptide area: `/peptide`, calculator, lexicon, admin research
- Official-API research batch (15 substances) compiled to `published.json`
- Research Batch 01 quality audit report `docs/RESEARCH_AUDIT_BATCH_01.md` and snapshot `docs/snapshots/2026-08-28-research-batch-01-audited.md`
- Published profile fields `regulatoryRegions` and `reviewItems`; Admin Research queue lists review items
- Shop storefront categories, orders/checkout, Discord-only OAuth hardening, customer role selling prices, shipping admin (present vs last origin commit)

### Changed

- Branding surface name Peptix; navigation includes Rechner & Lexikon outside shop
- Identity catalog remains F/insufficient until a sourced profile is applied
- Search-count sources classified as scientific (not primary trials)
- Orforglipron/Mazdutide development names on identity catalog

### Fixed

- Excluded fictional CT.gov example NCT07487363 and Hudson Biotech cluster from published studies
- Removed misassigned published NCTs (ipamorelin ibogaine study, tesamorelin generic GHRH MCI, GHK X39 patch, MOTS-c biomarker)

### Architecture

- Product vs substance split; research file-backed, not Postgres
- Browser connectors stay unavailable; Node scripts perform allowed API reads
- Review items live on compiled profiles, not a new Postgres queue

### Research

- ClinicalTrials.gov, PubMed, openFDA, PubChem, EMA EPAR HTTP check (2026-08-28)
- Reddit/community unavailable
- TB-500 kept distinct from Thymosin Beta-4; fictional NCT not treated as a trial
- No fabricated NCT/PMID/approvals
- Quality audit: evidence/regulatory enums unchanged; US/EU regions stored where sourced

## 2026-08-27 and earlier (committed)

See `git log` on `main`. Notable committed messages: env example ignore fix, `.vercel` ignore, Supabase malformed env guard, bulk pricing and product import.

# Changelog

Only material changes. Dates are local project days.

## 2026-08-28

### Added

- Project memory docs: `PROJECT_STATE.md`, `ARCHITECTURE.md`, `TODO.md`, this changelog, snapshot `docs/snapshots/2026-08-28-peptide-platform.md`, Cursor rule `.cursor/rules/project-memory.mdc`
- Independent peptide area: `/peptide`, calculator, lexicon, admin research
- Official-API research batch (15 substances) compiled to `published.json`
- Shop storefront categories, orders/checkout, Discord-only OAuth hardening, customer role selling prices, shipping admin (present in working tree vs last origin commit)

### Changed

- Branding surface name Peptix; navigation includes Rechner & Lexikon outside shop
- Identity catalog remains F/insufficient until a sourced profile is applied

### Fixed

- (Working tree also contains prior auth/env and cart fixes not all listed here; see git history `aa26e9f` and earlier)

### Architecture

- Product vs substance split; research file-backed, not Postgres
- Browser connectors stay unavailable; Node scripts perform allowed API reads

### Research

- ClinicalTrials.gov, PubMed, openFDA, PubChem, EMA EPAR HTTP check (2026-08-28)
- Reddit/community unavailable
- TB-500 kept distinct from Thymosin Beta-4
- No fabricated NCT/PMID/approvals

## 2026-08-27 and earlier (committed)

See `git log` on `main`. Notable committed messages: env example ignore fix, `.vercel` ignore, Supabase malformed env guard, bulk pricing and product import.

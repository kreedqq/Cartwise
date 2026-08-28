# Snapshot 2026-08-28 — peptide platform + research batch

Milestone: Peptid Rechner & Lexikon wired outside the shop; first official-API research batch compiled; project memory docs added.

## Status

SPA Peptix on Vite/React/Supabase. Shop + orders + Discord auth in code. Peptide area lazy-loaded under `ProtectedRoute`. Research published for 15 substances in `src/lib/peptide/profiles/published.json` (access 2026-08-28). Identity catalog: 27 entries. Working tree dirty vs `aa26e9f` on `main`.

## Functions

Shop (4 categories), carts, checkout, orders, favorites, templates, admin catalog/import/roles/shipping/orders, peptide hub/calculator/lexicon, admin research reports.

## Architecture

Client peptide models; Postgres for shop only. Connectors stubbed in browser. Node scripts fetch ClinicalTrials.gov, PubMed, openFDA, PubChem; EMA pages HTTP 200 for selected EPARs.

## Database

Migrations through `0023_reconstitution_water_and_ordered_cart_lock.sql`. No peptide SQL schema.

## Research

Cited FDA labels for approved GLP/GHRH/orforglipron products where Drugs@FDA matched. Retatrutide clinical-development (no FDA product). Community unavailable. Mock CT.gov titles dropped.

## Open

Uncommitted backup; remaining substances; persist research DB; Reddit official API or stay unavailable.

## Known problems

Lint react-refresh warnings; large JS chunks; peptide area not browser-verified while logged in during this snapshot; Excel product workbook absent from repo.

# TODO

Code wins if this list drifts. Check boxes only when the **code** has the behavior.

# Critical

- [x] User-approved git backup of the dirty `main` working tree (`0da9c90`; do not commit unless asked)
- [x] Keep Discord OAuth `skipBrowserRedirect` / no `authorize.json` download
- [x] Shop selling prices only via shop RPCs (not lexicon)

# High

- [x] Peptide routes outside `/shop`
- [x] Calculator without invented IU conversions
- [x] First research batch with cited official sources (15 substances)
- [x] TB-500 ≠ Thymosin Beta-4
- [x] Research Batch 01 quality audit (no Batch 02)
- [ ] Resolve Batch 01 Review Required: Mazdutide NMPA primary source, Orforglipron EMA, Hudson cluster
- [ ] Persist substance/source/study in Postgres with RLS + admin approve/reject of **new** drafts
- [ ] Populate remaining identity substances (Semax, Selank, TA-1, KPV, IGF-1 LR3, Somatropin, HCG, Gonadorelin, Melanotan II) **only** with verified sources — not until asked to start Batch 02
- [ ] Server-side live connectors (no secrets in the client) if ongoing scans are required
- [ ] Official Reddit API or keep connector unavailable (no scraping)

# Medium

- [ ] BfArM / MHRA connectors when a supported API exists
- [ ] Numeric PK from labels only when the exact figure is extracted and cited
- [ ] Glow-blend: scientific notes per component, still no shop prices
- [ ] Split or lazy-load `published.json` (catalog chunk size)
- [ ] Logged-in browser QA of peptide + shop regression
- [ ] Import `GENXELL_…xlsx` if the file is provided (file is not in the repo)

# Low

- [ ] Rename npm package `shared-cart-app` if desired
- [ ] Clear the five `react-refresh/only-export-components` lint warnings
- [ ] Research digest (“what changed this week”) once updates are persisted
- [ ] Optional substance field changelog

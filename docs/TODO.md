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
- [x] Research Batch 01 quality audit (no Batch 02 at audit time)
- [x] Research Batch 02 for remaining identity substances (12 slugs; exclusive: 9 complete, 1 partial igf-1-lr3, 2 review-required TA-1 + gonadorelin)
- [ ] Resolve remaining Review Required: Mazdutide NMPA, Orforglipron EMA, Hudson cluster, Zadaxin primary label, gonadorelin title-restricted literature
- [ ] Persist substance/source/study in Postgres with RLS + admin approve/reject of **new** drafts
- [x] Populate remaining identity substances with verified sources (Batch 02; Partial: IGF-1 LR3; Review Required: gonadorelin, thymosin-alpha-1)
- [ ] Server-side live connectors (no secrets in the client) if ongoing scans are required
- [ ] Official Reddit API or keep connector unavailable (no scraping)

# Medium

- [ ] BfArM / MHRA connectors when a supported API exists
- [ ] Numeric PK from labels only when the exact figure is extracted and cited
- [x] Glow-blend: scientific notes per component, still no shop prices
- [ ] Split or lazy-load `published.json` (catalog chunk size)
- [ ] Logged-in browser QA of peptide + shop regression
- [ ] Import `GENXELL_…xlsx` if the file is provided (file is not in the repo)

# Low

- [ ] Rename npm package `shared-cart-app` if desired
- [ ] Clear the five `react-refresh/only-export-components` lint warnings
- [ ] Research digest (“what changed this week”) once updates are persisted
- [ ] Optional substance field changelog

# Admin Backoffice IA + UI/UX

## Final state

Implemented locally (uncommitted at archive time). Frontend/IA only — no migrations, no business-engine changes.

## Delivered

- Ten commerce hubs in `adminNav.ts` with German labels and localStorage sidebar state
- Desktop collapsible sidebar + mobile drawer; chip hubs / section tabs retired
- `AdminPageHeader` section/subsection/breadcrumbs on admin pages
- `/admin/system` Wartung; Import + Importverlauf visible in nav
- All legacy routes kept; gates green (typecheck, lint, 1477 tests, build)

## Mapping note

Händlerkataloge / Area Preise / Area Kategorien / Area Design remain tabs inside `/admin/shop-areas`. No second pricing/kit/area engine. Consent stays customer `/consent`.

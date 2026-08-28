# UI Crash Fix (Phase 10D)

**Date:** 2026-08-29  
**Verdict:** **UI_CRASH_FIXED**  
**Git:** no commit, no push.  
**Deploy:** not done. **Database:** unchanged.

## Error

Production admin QA (`docs/RESEARCH_PRODUCTION_ADMIN_BROWSER_QA.md`) marked **BROWSER_QA_NOT_READY**.

| Surface | Symptom |
|---|---|
| `/peptide/lexikon/:slug` | Blank `#root` after “Profil wird geladen …” |
| `/peptide/rechner` | Blank `#root` |
| Console | `Slot failed to slot onto its children. Expected a single React element child or \`Slottable\`.` |
| Bundle | `button-C9NJmCLl.js` |

Admin Research, lexicon **list**, shop, and cart did not crash.

## Root cause

`src/components/ui/button.tsx` always rendered two Slot children:

```tsx
{loading && <Loader2 />}
{children}
```

`@radix-ui/react-slot` **1.3.x** only slots onto a **single** React element (or a `Slottable` marker). Even with `loading={false}`, `{loading && …}` is still a sibling (`false`), so `props.children` is an array. `React.isValidElement(children)` is then false and Slot throws.

Lexicon detail and the calculator never pass `loading`. They use:

```tsx
<Button asChild>
  <Link …>
</Button>
```

That combination is enough to crash. Native `<button>` (no `asChild`) was fine, which is why Admin Research kept working.

Confirmed locally: `src/tests/button.test.tsx` failed with the same Slot error **before** the fix (7 tests); native loading/disabled buttons already passed.

## Affected components / routes

**Primitive:** `Button` (`asChild` + optional spinner).

**`asChild` call sites (none pass `loading`):**

| File | Usage |
|---|---|
| `PeptideLexiconDetail.tsx` | Link “Im Rechner verwenden” |
| `PeptideCalculator.tsx` | Link “Zum Lexikon” |
| `Dashboard.tsx` | Link “Zum Shop” (empty-cart empty state only) |
| `Register.tsx` | Link “Zur Anmeldung” (post-signup) |
| `NotFound.tsx` | Link home |
| `Forbidden.tsx` | Link home |

**`loading` without `asChild`:** login/register/forgot/reset submit, cart add/rename/delete, checkout, shop quick-add, several admin saves. Unchanged visually; spinner still sits beside the label on a real `<button>`.

No shop/auth/admin-research redesign. No review actions. No lexicon Postgres switch.

## Fix

Keep `asChild` and the loading spinner. Mark the real child with Radix `Slottable` so extra nodes (spinner or `null`) merge **into** the slotted element instead of competing with it:

```tsx
{loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
<Slottable>{children}</Slottable>
```

- `asChild={false}`: `Slottable` just renders `children`; spinner + `disabled` + `aria-busy` on `<button>` as before.
- `asChild={true}`: Slot merges className/`aria-busy`/`disabled` onto the single child (`Link` / `<a>`). If `loading`, the spinner is injected inside that child.
- Keyboard / focus styles still come from `buttonVariants`. Loading still sets `disabled={disabled \|\| loading}` and `aria-busy`.

No second Button system. Call sites were not rewritten.

## Regression tests

`src/tests/button.test.tsx` (new; existing tests kept):

- Native button, loading + submit, disabled
- `asChild` + React Router `Link`
- `asChild` + `loading`
- `asChild` + native `<a>`
- Calculator mounts; tabs Rekonstitution / Konzentration / Einheiten / Vial; units g/mg/mcg/ng present
- Lexicon detail for `retatrutide`, `tirzepatide`, `semaglutide` (Overview, Mechanism, Effects, Safety, Interactions, Reconstitution, Clinical Trials, Sources, Evidence)

## Build

| Gate | Result |
|---|---|
| `npm test` | **409** passed (33 files) |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors; 5 pre-existing `react-refresh/only-export-components` warnings (including `buttonVariants`) |
| `npm run build` | pass; new chunk `button-Dq-9OMxe.js` |

## Browser QA (local preview of this build)

`npm run preview` → `http://127.0.0.1:4173`

| Check | Result |
|---|---|
| `/login` | Renders; no Slot error |
| `/register` | Renders; no submit |
| `/403` (`Button asChild`) | Heading + “Zurück zur Übersicht” link; `#root` populated |
| unknown route (`Button asChild`) | 404 page; same |
| `/peptide/lexikon/retatrutide` | Redirects to `/login` (ProtectedRoute; no session on localhost). Detail **render** covered by tests |
| Console | No `Slot failed…`; no 404/500 on sampled assets |
| Auth | Unchanged; no login attempted |

Lexicon list/search, calculator interaction, Admin Research, shop, and cart were **not** re-run in the local browser (no localhost admin session; no auth bypass). They are covered by the page unit tests (calculator + three details) and by the prior production QA for admin/shop/list (those surfaces never used `asChild` on the crashing path).

## Known limitations

- Not deployed. Production `cartwise-zeta` still serves `button-C9NJmCLl.js` until a later SPA deploy.
- Local preview cannot open protected peptide/admin/shop without a session.
- `asChild` + `loading` still forwards HTML `disabled` onto `<a>`/`Link` (pre-existing Slot merge). Spinner + `aria-busy` are set.

## STOP

No production deploy. No commit. No push. No lexicon switch. No Batch 03. No community. No migration.

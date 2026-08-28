# Production Browser QA (Phase 9)

**Date:** 2026-08-28  
**Verdict:** **BROWSER_QA_PASS_WITH_LIMITATIONS**  
**Git:** no commit, no push.  
**Architecture:** unchanged. No lexicon switch, community, Batch 03, or new research data.

## Environment

| Item | Value |
|---|---|
| Production database | `cartwise-prod` (`cnjrjinvxycdkrmzcime`, `eu-west-2`, `ACTIVE_HEALTHY`) |
| Live migrations | `0001`–`0029` |
| Production SPA | `https://cartwise-zeta.vercel.app` (title **Peptix**) |
| SPA → API | `https://cnjrjinvxycdkrmzcime.supabase.co` (confirmed in the live bundle host string; no keys copied) |
| Public lexicon mode | `legacy` (`catalog.ts` + `published.json`) |
| Admin Research (working tree) | Postgres primary (Phase 8, **not in the hosted SPA**) |
| Dual-read | available in the working tree; production env stays `legacy` |

`https://cartwise.vercel.app` returns a generic Vite 404 (`index-BeHRNOV-.js`). It is **not** the Peptix SPA. Deployment hashes under `*-pepsi7.vercel.app` are SSO-protected. GitHub Pages `kreedqq.github.io/Cartwise` is 404.

The hosted Peptix SPA (`index-3Jxwuqf6.js`) predates uncommitted Phase 7–8 client work. Live **data** is Phase 6C (`0024`–`0029`). Live **Admin Research UI** on Vercel is still the pre-Phase-8 page until that client is deployed (not done here).

## Session

Cursor browser had **no** existing Supabase session (`authStoragePresent: false`). Credentials were not read from files. Auth was not bypassed. RLS was not bypassed. No review writes, deletes, bulk approvals, or orders were performed.

Logged-in Admin Research, lexicon, shop, cart, calculator, mapping UI, and review-action writes are therefore **NOT TESTED** in the browser.

## Live database (read-only, cartwise-prod)

These counts match the Phase 8 inventory. They are **not** a substitute for the Admin UI.

| Table / filter | Count |
|---|---|
| substances | 27 |
| sources | 412 |
| studies | 118 |
| claims | 294 |
| evidence_assessments | 294 |
| evidence `review-required` | 267 |
| regulatory_records | 41 |
| review_actions | 19 |
| product_substances | 93 |
| products | 320 |
| studies `NCT07487363` / `NCT07437560` | **0** |
| product_substances for `BT*` / `MT1*` / `KL80*` | **0** |
| `RT5` `RT10` `RT20` `RT30` `RT40` → retatrutide | 5 |
| FOUNDAYO / `NDA220934` / US / FDA | 1 row, `approved_specific_indication`, `is_current` true |
| Retatrutide FDA US | `clinical_development` |

Mappings sampled live: `TR*` → tirzepatide (manual), `SMO*` → sermorelin (manual), `TA*` → thymosin-alpha-1 (manual), `ML10` → melanotan-ii (manual), `BBG70` → glow-blend (name).

## Browser session (unauthenticated)

| Surface | Result |
|---|---|
| `/login` | Renders Peptix dark/gold login: Passwort, Magic Link, Discord, register link |
| `/register` | Name, email, password, Discord, back to login |
| `/forgot-password` | Email + “Link senden”; not submitted |
| `/shop` (no session) | Redirects to `/login` |
| `/peptide/lexikon`, `/peptide/rechner`, `/admin/research`, `/403` as **full document loads** | Automation saw a blank `#root` after wait; not treated as a confirmed production outage (see limitations) |
| Client-side `/shop` from a mounted login | React Router sent the URL back to `/login` (Anmelden still visible) |
| Mobile 390×844 login | Form usable (Passwort / Magic Link / Discord / register) |
| Login network | HTML/JS/CSS/`peptix-brand.jpg` **200**; navigation ~92 ms; no 404/500 on those assets |
| Secrets in logs | None observed |

## Fallback (static, not runtime-broken)

Postgres was not taken down. `AdminResearch.tsx` in the working tree shows a labeled **Legacy-Fallback anzeigen (published.json)** only after dashboard fetch failure. Not exercised live.

## Security

| Check | Status |
|---|---|
| Unauthenticated `/shop` does not show catalog | PASS (redirect to login) |
| Unauthenticated user cannot use an admin session | PASS (no session present) |
| Non-admin account cannot open Admin Research | **NOT TESTED** (no non-admin session) |
| Non-admin cannot write `review_actions` | **NOT TESTED** in browser; SQL policies remain admin INSERT/SELECT only (Phase 8) |
| Review-required evidence public read | **NOT TESTED** in browser; 0028 still live on `cartwise-prod` |

## QA matrix

| Test | Expected | Actual | Status | Notes |
|---|---|---|---|---|
| Production target | cartwise-prod + Peptix SPA | zeta SPA + `cnjrjinvxycdkrmzcime` | PASS | `cartwise.vercel.app` is a different 404 site |
| Login UI | Peptix auth, Discord only | Passwort / Magic Link / Discord | PASS | No credentials entered |
| Session persistence | Existing admin session | None in this browser | BLOCKED | Limitation, not a product defect |
| Admin recognition | Admin nav + `/admin/research` | Not reachable | NOT TESTED | Needs admin session |
| Admin Research dashboard | Sources 412, studies 118, claims 294, … | Counts confirmed in DB only | NOT TESTED | Hosted SPA also predates Phase 8 UI |
| Evidence queue 267 | Admin sees review-required | 267 rows in DB | NOT TESTED | UI not opened |
| Claim / evidence / regulatory detail | Sources + studies visible | — | NOT TESTED | |
| Source / study traceability | Claim → source / study | — | NOT TESTED | |
| Review action write | Optional reversible test | Not executed | NOT TESTED | **Review Action Write Path = NOT TESTED** |
| Append-only history | No UPDATE/DELETE UI | Not exercised live | NOT TESTED | Code/SQL still INSERT-only |
| Product mapping UI | RT/TR/SMO/TA/ML10/Glow; no prices | DB mapping OK; UI not opened | NOT TESTED | BT/MT1/KL80 unmapped in DB |
| Public lexicon search / cards / details | File-based lexicon works | Behind login | NOT TESTED | |
| TB-500 ≠ TB4 and other identity | Separate substances | Files + DB identity; UI not opened | NOT TESTED | Hudson NCTs are 0 study rows |
| Hudson NCTs as studies | Absent | 0 in `studies` | PASS | Notes in `published.json` explain exclusion |
| Community as evidence | unavailable | UI not opened | NOT TESTED | Community still unpublished |
| Calculator | Units, no invented IU | Behind login | NOT TESTED | |
| Shop 320 / cart / checkout | List + cart; no real order | Behind login | NOT TESTED | 320 products in DB |
| Auth regression / logout | Session + logout | No session | NOT TESTED | Login/register/forgot render |
| Navigation desktop/mobile | Sidebar / mobile nav | Only public login | NOT TESTED | Mobile login form OK |
| Fallback runtime | Labeled legacy on Postgres fail | Not forced | NOT TESTED | Static code present in working tree |
| Console | No unhandled errors on login | Login rendered; no overlay | PASS | Deep-link blank pages had empty `#root` in automation |
| Network | Research requests OK | No research calls without session | NOT TESTED | Login assets 200 |
| Non-admin RLS | Denied writes | No second account | NOT TESTED | |
| Performance | No obvious hang on login | ~92 ms navigation | PASS | Authenticated lexicon/admin not measured |

## Known limitations

1. **No admin (or any) session** in the Cursor browser. Logged-in peptide, shop, cart, calculator, admin research, mapping, and review writes were not run.
2. **Hosted SPA ≠ working-tree Phase 8.** Admin Postgres dashboard/queue is implemented locally and is **not** what Vercel currently ships.
3. **Full-page nested routes** (`/peptide/lexikon`, `/admin/research`, and `/403`) rendered an empty `#root` in this automation after a wait; `/login` and `/shop`→login worked. Treat as **automation / deep-link inconclusive**, not a confirmed production outage. Needs a human reload in a normal browser.
4. **Review Action Write Path = NOT TESTED** (no safe reversible fixture used; no scientific row changed).
5. **Non-admin security path = NOT TESTED.**
6. `https://cartwise.vercel.app` is not Peptix.

## Gates (after QA, no product-code changes)

| Gate | Result |
|---|---|
| Tests | 399 passed / 32 files |
| Typecheck | pass |
| Lint | 0 errors, 5 existing `react-refresh` warnings |
| Build | pass |

## STOP

No public lexicon switch. No community. No Batch 03. No new research rows. No commit. No push.

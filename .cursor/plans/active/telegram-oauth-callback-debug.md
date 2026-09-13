# Telegram OAuth Final Debug (callback race)

## Root cause (proven in code)
1. `detectSessionInUrl: true` exchanges `?code=` on `/auth/callback`.
2. `completeOAuthCallback` also called `exchangeCodeForSession`.
3. After linking work, any exchange error + prior session → `{ status: "failed" }` — including code-already-used / invalid flow after auto-detect.
4. `AuthCallback` also navigated from `onAuthStateChange` while `complete()` ran → race / unmount / loop risk.

## Fix (minimal)
- Fail with prior session **only** on identity-already-linked.
- Session present after exchange attempt → `authenticated` (covers double-exchange).
- AuthCallback: single completion path; no `onAuthStateChange` navigate.
- Short OAuth flow lock + non-secret `[peptix:oauth]` diagnostics.

## Remaining
- Gates + commit/push/deploy
- Interactive Telegram browser QA (QR → confirm → session)

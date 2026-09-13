# Telegram Identity Management Final

## Completed this session

- Root cause of generic `@penny` toast: `mapUsernameError` ignored PostgREST plain-object `{ message, details, hint }` → empty string → fallback „Der Telegram Benutzername konnte nicht zugewiesen werden.“
- Secondary: Flow B `apply_telegram_reauth_username` always overwrote `profiles.username` with `preferred_username` (could fail duplicate / confuse linking when username already `penny`).
- Secondary: `complete_telegram_identity_transfer` set `status='expired'` which violates CHECK (`pending|completed|cancelled|failed`) — expired path could throw mid-cleanup.
- Migration `0080` on prod: keep username on link/transfer; `admin_remove_telegram_identity`; expire → `failed`+`expired`.
- Client: error extraction; AuthCallback link failure → `/username-required`; Admin remove UI.
- Gates: typecheck/lint/test/build green (1443 tests).

## Remaining

- Real browser QA for penny link→conflict→transfer and admin remove (needs credentials / Telegram app).
- Commit + push SPA after gates (user requested).

## Decisions

- Identity owner = `auth.identities`; PEPTIX handle = `profiles.username` — never conflate on normal login.
- Linking with existing username: consume flag only; do not adopt preferred.

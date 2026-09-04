# Auth providers (Telegram + Discord)

No client secrets, bot tokens, or OAuth client secrets belong in this repository.

Frontend: `src/services/auth.ts`, `AuthProvider`, `/login`, `/auth/callback`.
Identity shown in the UI: `profiles.username` (Telegram handle). Orders copy that into `orders.telegram_username_snapshot` at checkout.

## Shared rules

- `skipBrowserRedirect: true` so a GoTrue JSON error is never assigned to `window.location` (that downloaded `authorize.json`).
- Redirect URL is `getRedirectUrl("/auth/callback")` from `window.location.origin` (never a baked-in localhost URL in production).
- Password login waits for a client session before navigating.
- Telegram does **not** merge existing accounts by username. Linking is explicit.
- Production **Site URL** (Supabase Auth): `https://peptix.app`.

## Telegram — Custom OIDC `custom:telegram`

| Item | Value / rule |
|---|---|
| Supabase provider id | `custom:telegram` |
| Scopes | `openid profile` (no phone) |
| Frontend constant | `TELEGRAM_OAUTH_PROVIDER`, `TELEGRAM_OAUTH_SCOPES` |
| Callback (app) | `https://peptix.app/auth/callback` |
| Callback (Supabase) | `https://cnjrjinvxycdkrmzcime.supabase.co/auth/v1/callback` |
| Origin | `oauth.telegram.org/auth` returns **origin required** unless `origin` is on the authorize URL. The SPA sets `queryParams.origin` and `withTelegramOriginParam`. |
| Client ID | Dashboard configuration only. Not a Git secret. May be recorded privately. |
| Client secret | **Never store in Git or backups.** |

BotFather: configure the bot’s domain / allowed callback URLs to include `https://peptix.app` and the Supabase callback host. Do not paste the bot token into this repo.

Username after login is written to `profiles.username` via `set_username`. Cart titles use `profiles.username` + `name_ordinal`.

## Discord

| Item | Value / rule |
|---|---|
| Provider | built-in `discord` |
| Frontend | same `signInWithOAuth` path, `skipBrowserRedirect: true` |
| Callback (app) | `https://peptix.app/auth/callback` |
| Redirect resolution | `resolveOAuthRedirectUrl` follows GoTrue `/authorize` without treating JSON 400 as a navigation target |

Configure the Discord application’s redirect to the Supabase Auth callback. Client secret stays in the Discord developer portal and Supabase provider settings.

## Local allowed URLs

For `npm run dev`:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/**` as needed in Additional Redirect URLs

Do not replace the production Site URL with localhost.

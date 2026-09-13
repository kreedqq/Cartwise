# Telegram Reauth Username (admin next-login)

## Goal
Replace free-text next-login username change with Telegram OIDC reauthentication that copies `preferred_username` from `auth.identities` (`custom:telegram`).

## Security fix (pre-deploy)
30-minute `last_sign_in_at` alone was insufficient: Email/Discord login after a recent Telegram link could consume the flag. `0076` now also requires:
1. JWT `app_metadata.provider = custom:telegram`
2. Telegram identity `last_sign_in_at >= JWT iat - 5 minutes`
3. Absolute 30-minute ceiling

## Architecture (reuse)
- Flag: `profiles.username_required_on_next_login`
- Admin RPC: `admin_set_username_required`
- Admin direct edit: `admin_set_username` (clears flag)
- Client gate: `SIGNED_IN` + sessionStorage
- RPC: `apply_telegram_reauth_username`
- `set_username`: initial claim only

## Status
- Migration ready for controlled production apply
- Protected docs not part of this commit
- Browser E2E needs interactive Telegram for `@Test`

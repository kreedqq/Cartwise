# Telegram OAuth flow separation

## Production account facts (read-only, 2026-09-13)
- Admin `f0dc82df…` (@penny): providers=`email` only, `username_required_on_next_login=true`, **no** `custom:telegram`
- Telegram preferred_username `pepsidry` lives on `f500febb…` (@Pepsidryage): email+discord+telegram, flag=true, **not** admin
- Pending transfer intent targeted admin (`28857101…`) — leftover from Flow C testing
- Normal Telegram login of that Telegram account therefore signs into @Pepsidryage, not admin

## Code root cause
AuthCallback completed transfer whenever `readTelegramTransferIntent()` was set — including after normal `/login` Telegram OAuth (Flow A hijack).
Conflict UI could also appear from stale sessionStorage conflict markers.

## Fix
- `OAuthFlowKind`: `login` | `link` | `transfer`
- Transfer RPC only when `flowKind === "transfer"` AND intent present
- Login clears stale intent + conflict
- Conflict toast only for `flowKind === "link"`
- Conflict marker TTL 15m

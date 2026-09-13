# Telegram Identity Transfer + Auth Custom Domain

## Transfer (code)
- Migration `0078_telegram_identity_transfer.sql`: intents + `create_telegram_transfer_intent` / `complete_telegram_identity_transfer`
- Conflict UI on `/username-required` after linkIdentity fails with already-linked
- Confirm → intent → fresh Telegram OAuth as identity owner → RPC moves `custom:telegram` to target
- Blocks Telegram-only source accounts; fail-closed on duplicate username / missing preferred_username
- No account merge; orders/data untouched

## Custom domain `auth.peptix.app`
- **BLOCKED**: org lacks Custom Domain add-on (Pro+). CLI: `entitlement_required`
- Do not invent DNS. After add-on: `supabase domains create --custom-hostname auth.peptix.app`, add CNAME+TXT from CLI, reverify, add Telegram callback `https://auth.peptix.app/auth/v1/callback` **in addition** to existing supabase.co callback, then activate
- Keep Site URL as `https://peptix.app`; do not set Site URL to auth subdomain

## Remaining
1. Apply `0078` with explicit approval (not blind db push)
2. Tests / typecheck / lint / build
3. Controlled QA A(email+telegram) / B(email only)
4. Custom domain only after billing add-on

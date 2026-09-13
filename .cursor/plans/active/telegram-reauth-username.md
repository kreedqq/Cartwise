# Telegram Account Linking (admin next-login)

## Goal
Attach `custom:telegram` to the **existing** PEPTIX `auth.users` row via `linkIdentity`. Never create a second account with signOut + signInWithOAuth.

## Status (this session)
- Client: `linkTelegramIdentity` / `startTelegramAccountLink`; UsernameRequired no longer signs out before Telegram
- Callback: exchange OAuth `code` even when a session already exists (required for linkIdentity)
- Migration `0077_telegram_identity_linking.sql`: apply RPC accepts fresh linked identity (JWT may stay email) while keeping 0076 Path A + 30m ceiling
- Tests updated; 0070 untouched; 0076 not rewritten
- **Not done**: Manual Linking must be enabled in Supabase Auth Dashboard; `0077` not applied to prod; no commit/deploy; browser E2E pending

## Remaining
1. Enable **Manual Linking** (Auth settings) on cartwise-prod
2. Apply `0077` only after explicit approval (no blind `db push --linked`)
3. Controlled QA: email user without Telegram → admin force → login → link → same `auth.users.id`
4. Commit / deploy only when asked

## Fail closed
- Telegram identity already on another user
- Duplicate `profiles.username`
- Missing `preferred_username`
- Email/Discord cannot consume the flag without fresh Telegram identity proof

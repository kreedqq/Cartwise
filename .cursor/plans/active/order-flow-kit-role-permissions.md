# Order flow audit + Kit role permissions

## Status

Implementation complete locally. **Not committed. Not deployed. Migrations not applied to production.**

## Root cause

`create_order` → `create_one_area_order`. Incomplete kit cart lines (`kit_shares.status` not in `full`/`ordered`) raised `Ungültiger Kit-Anteil im Warenkorb.` and aborted the whole area order under One Cart. UI masked PostgREST objects via `instanceof Error` only → generic toast.

## Done

- `0088_checkout_skip_incomplete_kit_lines.sql`: skip incomplete kits; area filter on orderable lines
- Checkout/orders: `extractRpcErrorMessage`
- `0089_kit_request_role_permission.sql`: `can_use_kit_requests` fail-closed; Group Buy seeded true
- Admin role checkbox + customer UI gating via `get_my_can_use_kit_requests`
- Tests: `checkoutOrderFlow.test.ts`, `kitRequestRolePermission.test.ts`
- Gates: typecheck, lint (warnings only), test, build — pass

## Next (needs explicit user approval)

1. COMMIT
2. Apply `0088` + `0089` to production (not `db reset` / not blind push)
3. PRODUCTION DEPLOY

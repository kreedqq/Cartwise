-- rls_test_scenarios.sql
--
-- Manual RLS verification script. This is NOT run automatically in CI (that
-- would require a disposable Supabase project with seeded auth users, which
-- is out of scope for a static GitHub Actions build - see docs/RISKS.md).
-- Run this against a DEV/staging Supabase project's SQL Editor after
-- applying all migrations, to confirm the policy matrix in
-- docs/SECURITY.md actually holds. Each block states the expected result.
--
-- Prerequisite: two confirmed users already exist (sign up normally via the
-- app), and you know their auth.uid() values. Replace the placeholders
-- below. Do NOT run this against production data - it inserts and deletes
-- test rows.

-- Find your two test user ids:
select id, email from auth.users order by created_at desc limit 5;

-- Substitute these before running the rest of the script:
--   :user_a  = first test user's uuid (acts as a normal 'user')
--   :user_b  = second test user's uuid (acts as another normal 'user')

-- ============================================================================
-- Scenario 1: a user can only see their own carts.
-- ============================================================================

-- As user_a (use `select set_config('request.jwt.claims', json_build_object('sub', :'user_a', 'role','authenticated')::text, true);`
-- in a real PostgREST-authenticated session, or exercise this via the app UI
-- with two separate accounts - RLS depends on auth.uid() from the JWT, which
-- only PostgREST/Supabase's connection pooler sets up correctly.)

-- Expected: this returns ONLY carts where user_id = user_a's id, never user_b's,
-- even though the query has no WHERE user_id = ... clause itself.
-- select * from carts;

-- ============================================================================
-- Scenario 2: a user cannot read another user's cart by guessing its id.
-- ============================================================================
-- 1. As user_a, create a cart and note its id.
-- 2. As user_b, run: select * from carts where id = '<user_a-cart-id>';
-- Expected: zero rows (not an error - RLS makes it invisible, which also
-- prevents existence-enumeration).

-- ============================================================================
-- Scenario 3: a user cannot write to another user's cart_items.
-- ============================================================================
-- As user_b, attempt:
--   insert into cart_items (cart_id, product_code_input, quantity)
--   values ('<user_a-cart-id>', 'ART-1001', 1);
-- Expected: fails with a row-level security policy violation (42501-style),
-- because cart_items_insert_own requires the cart to belong to auth.uid().

-- ============================================================================
-- Scenario 4: only admins can write to products.
-- ============================================================================
-- As a non-admin user, attempt:
--   insert into products (code, name, price_usd) values ('TEST-1', 'Test', 1);
-- Expected: fails with a policy violation.
-- As an admin (see docs/FIRST_ADMIN.md), the same statement succeeds.

-- ============================================================================
-- Scenario 5: user_roles cannot be self-granted from the client.
-- ============================================================================
-- As any authenticated (non-service-role) user, attempt:
--   insert into user_roles (user_id, role) values (auth.uid(), 'admin');
-- Expected: fails - there is no INSERT policy on user_roles for the
-- 'authenticated' role at all (see 0002_profiles_and_roles.sql). The only
-- legitimate path is the set-user-role Edge Function (service-role) or the
-- documented first-admin SQL bootstrap run by the project owner.

-- ============================================================================
-- Scenario 6: optimistic locking rejects a stale update instead of silently
-- overwriting a concurrent change.
-- ============================================================================
-- As user_a:
--   select id, version from carts where id = '<cart-id>'; -- note version, e.g. 3
--   update carts set name = 'Erster Versuch' where id = '<cart-id>' and version = 3;
--   -- succeeds, version becomes 4 (bump_version trigger)
--   update carts set name = 'Zweiter Versuch (veraltet)' where id = '<cart-id>' and version = 3;
-- Expected: the second UPDATE matches zero rows (version is now 4), which
-- the application surfaces as a ConcurrencyError instead of applying it.

-- ============================================================================
-- Scenario 7: has_role() does not recurse and correctly reflects admin state.
-- ============================================================================
-- select public.has_role('<user_a-id>', 'admin'); -- expect false initially
-- (grant admin per docs/FIRST_ADMIN.md)
-- select public.has_role('<user_a-id>', 'admin'); -- expect true

-- ============================================================================
-- Scenario 8: apply_pdf_import() rejects non-admin callers.
-- ============================================================================
-- As a non-admin user, attempt:
--   select apply_pdf_import('x', 'x.csv', 10, null, '[]'::jsonb);
-- Expected: raises "Nur Admins dürfen Importe anwenden." (42501).

-- ============================================================================
-- Scenario 9: a deleted/deactivated product does not break historical carts.
-- ============================================================================
-- 1. Create a product, add it to a cart (creates a price snapshot).
-- 2. Deactivate the product (is_active = false).
-- 3. Reload the cart: the line item still shows its snapshot name/price
--    (product_name_snapshot etc.), with resolution_status = 'inactive', and
--    still contributes to the cart's totals using the snapshot values.

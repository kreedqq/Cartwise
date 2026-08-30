-- One-off local reproduction script (NOT a migration). Verifies:
--   TEST 1: A's cart shows exactly 6, not 10
--   TEST 2: B's cart shows exactly 4
--   TEST 3: A orders successfully
--   TEST 4: B can still order after A (this is the reported P0001 bug)
--   TEST 20/21/22: kit stays usable for B, B's own order succeeds
-- Run against a local `supabase start` instance only. Never run in production.

\set ON_ERROR_STOP on
\pset format aligned

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'repro-a@test.local', 'x', now(), '{}', '{}', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'repro-b@test.local', 'x', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

update public.profiles set username = 'ReproUserA' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set username = 'ReproUserB' where id = 'bbbbbbbb-0000-0000-0000-000000000002';

insert into public.products (code, name, dosage_vial, description, category, price_usd, bulk_price_usd, bulk_price_min_quantity, is_active)
values ('REPRO-KIT-1', 'Repro Kit Produkt', '10 mg / Vial', 'Reproduktions-Testprodukt', 'Präparate', 100.00, null, null, true)
on conflict (code) do update set is_active = true;

select id as product_id from public.products where code = 'REPRO-KIT-1' \gset

-- === A creates a 10-vial kit, keeps 6 for themself ===
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001')::text, false);
select public.create_kit_share(:'product_id'::uuid, 10, 6) as kit_json \gset
select (:'kit_json'::jsonb ->> 'id') as kit_share_id \gset

\echo '--- Kit created by A ---'
select :'kit_json'::jsonb;

-- === A invites B for the remaining 4 ===
select public.invite_kit_share_participant(:'kit_share_id'::uuid, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 4) as invite_json \gset
\echo '--- After inviting B (kit should now be status=full) ---'
select :'invite_json'::jsonb -> 'status' as kit_status;

\echo '=== TEST 1: A cart must show exactly 6 (not 10) ==='
select ci.quantity, ci.kit_share_id
from public.cart_items ci
join public.carts c on c.id = ci.cart_id
where c.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and ci.kit_share_id = :'kit_share_id'::uuid;

-- === B's view ===
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-0000-0000-000000000002')::text, false);
\echo '=== TEST 2: B cart must show exactly 4 ==='
select ci.quantity, ci.kit_share_id
from public.cart_items ci
join public.carts c on c.id = ci.cart_id
where c.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and ci.kit_share_id = :'kit_share_id'::uuid;

-- === TEST 3: A orders first ===
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001')::text, false);
select c.id as a_cart_id
from public.carts c
where c.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and c.is_active_cart and c.status in ('draft', 'ready')
limit 1 \gset

\echo '=== TEST 3: create_order for A ==='
select public.create_order(:'a_cart_id'::uuid, 'Repro Test A', 'paypal') as a_order_json \gset
select :'a_order_json'::jsonb;

\echo '--- Kit status after A ordered (must stay full/open for B, NOT ordered yet) ---'
select status from public.kit_shares where id = :'kit_share_id'::uuid;

-- === TEST 4: B orders after A — must succeed (this reproduces/validates the P0001 fix) ===
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-0000-0000-000000000002')::text, false);
select c.id as b_cart_id
from public.carts c
where c.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and c.is_active_cart and c.status in ('draft', 'ready')
limit 1 \gset

\echo '=== TEST 4: create_order for B (previously failed with P0001) ==='
select public.create_order(:'b_cart_id'::uuid, 'Repro Test B', 'crypto') as b_order_json \gset
select :'b_order_json'::jsonb;

\echo '--- Kit status after BOTH ordered (must now be ordered) ---'
select status from public.kit_shares where id = :'kit_share_id'::uuid;

\echo '=== TEST: A cart is ordered, B cart is ordered, orders are separate ==='
select c.user_id, c.status from public.carts c where c.id in (:'a_cart_id'::uuid, :'b_cart_id'::uuid);

\echo '=== TEST: payment_method persisted correctly for both orders ==='
select user_id, payment_method, total_usd from public.orders where cart_id in (:'a_cart_id'::uuid, :'b_cart_id'::uuid);

\echo '=== TEST: duplicate create_order on the same (already-ordered) cart is rejected (expect ERROR P0001 below) ==='
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001')::text, false);
\set ON_ERROR_STOP off
select public.create_order(a_cart_id, 'dup', 'paypal')
from (select :'a_cart_id'::uuid as a_cart_id) s;
\set ON_ERROR_STOP on

rollback;

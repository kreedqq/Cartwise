-- 0011_cart_rpcs.sql
-- Small RPCs for cart operations that must be atomic across more than one
-- row (RLS + a plain two-step client UPDATE could race between browser
-- tabs). SECURITY INVOKER: RLS applies exactly as normal, this only buys
-- atomicity, not elevated privilege.

create or replace function public.set_active_cart(_cart_id uuid)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.carts
    where id = _cart_id and user_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  update public.carts
  set is_active_cart = false
  where user_id = auth.uid() and is_active_cart = true and id <> _cart_id;

  update public.carts
  set is_active_cart = true
  where id = _cart_id;
end;
$$;

comment on function public.set_active_cart(uuid) is
  'Atomically marks one cart as the active cart for the calling user, unsetting any previous one.';

revoke all on function public.set_active_cart(uuid) from public;
grant execute on function public.set_active_cart(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Duplicate a cart (and its items) in one transaction, so the copy always
-- has a complete, consistent item list even under concurrent edits.

create or replace function public.duplicate_cart(_cart_id uuid, _new_name text)
returns uuid
language plpgsql
as $$
declare
  _new_cart_id uuid;
begin
  if not exists (
    select 1 from public.carts where id = _cart_id and user_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.carts (user_id, name, status, note)
  select user_id, _new_name, 'draft', note
  from public.carts
  where id = _cart_id
  returning id into _new_cart_id;

  insert into public.cart_items (
    cart_id, position, product_id, product_code_input, product_code_snapshot,
    product_name_snapshot, quantity, unit_price_usd_snapshot, exchange_rate_snapshot,
    eur_value_snapshot, price_snapshot_at, resolution_status, note
  )
  select
    _new_cart_id, position, product_id, product_code_input, product_code_snapshot,
    product_name_snapshot, quantity, unit_price_usd_snapshot, exchange_rate_snapshot,
    eur_value_snapshot, price_snapshot_at, resolution_status, note
  from public.cart_items
  where cart_id = _cart_id;

  return _new_cart_id;
end;
$$;

comment on function public.duplicate_cart(uuid, text) is
  'Copies a cart and all its line items (including price snapshots) into a new draft cart.';

revoke all on function public.duplicate_cart(uuid, text) from public;
grant execute on function public.duplicate_cart(uuid, text) to authenticated;

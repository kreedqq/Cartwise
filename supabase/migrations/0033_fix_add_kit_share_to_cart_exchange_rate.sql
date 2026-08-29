-- 0033_fix_add_kit_share_to_cart_exchange_rate.sql
-- Fix add_kit_share_to_cart: exchange_rates.rate was referenced as exchange_rate (42703).

create or replace function public.add_kit_share_to_cart(_kit_share_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _participant public.kit_share_participants;
  _cart_id uuid;
  _position integer;
  _markup numeric;
  _unit numeric;
  _catalog_vial numeric;
  _rate numeric;
  _line numeric;
  _item_id uuid;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status <> 'full' then
    raise exception 'Das Kit ist noch nicht vollständig verteilt.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if not found then
    raise exception 'Keine Berechtigung für dieses Kit.' using errcode = '42501';
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select id into _cart_id
  from public.carts
  where user_id = _uid and is_active_cart and deleted_at is null and status in ('draft', 'ready')
  limit 1;

  if _cart_id is null then
    insert into public.carts (user_id, name, status, is_active_cart)
    values (_uid, 'Warenkorb', 'draft', true)
    returning id into _cart_id;
  end if;

  select coalesce(max(position), -1) + 1 into _position
  from public.cart_items where cart_id = _cart_id;

  _markup := public.markup_percent_for(_uid);
  _catalog_vial := _product.price_usd / _kit.kit_size_vials;
  _unit := public.apply_role_markup(_catalog_vial, _markup);

  select rate into _rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'EUR'
  order by fetched_at desc nulls last
  limit 1;

  _line := round((_participant.quantity * _unit)::numeric, 2);

  delete from public.cart_items
  where cart_id = _cart_id and kit_share_id = _kit_share_id and product_id = _product.id;

  insert into public.cart_items (
    cart_id, position, product_id, product_code_input, product_code_snapshot, product_name_snapshot,
    quantity, unit_price_usd_snapshot, normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier, exchange_rate_snapshot, eur_value_snapshot,
    price_snapshot_at, resolution_status, note, kit_share_id
  )
  values (
    _cart_id, _position, _product.id, _product.code, _product.code, _product.name,
    _participant.quantity, _unit, _unit, null, null, 'normal',
    _rate, case when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2) else null end,
    now(), 'resolved',
    format('Gemeinsames %s-Vial-Kit · Meine Menge: %s Vials', _kit.kit_size_vials, _participant.quantity),
    _kit_share_id
  )
  returning id into _item_id;

  return _item_id;
end;
$$;

revoke all on function public.add_kit_share_to_cart(uuid) from public;
grant execute on function public.add_kit_share_to_cart(uuid) to authenticated;

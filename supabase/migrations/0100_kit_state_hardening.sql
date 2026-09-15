-- 0100_kit_state_hardening.sql
-- Harden kit status derivation, checkout-ready gate, and full-kit cart sync.
-- Does not modify 0070 or 0091–0097 files. Additive replacements via CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- Allocation SSoT for checkout (read-only helper)
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_allocation_matches_size(_kit_share_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.kit_share_allocated_total(_kit_share_id) = ks.kit_size_vials
      from public.kit_shares ks
      where ks.id = _kit_share_id
    ),
    false
  );
$$;

revoke all on function public.kit_share_allocation_matches_size(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_share_refresh_status_locked — sum ↔ open/full (ordered/cancelled frozen)
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_refresh_status_locked(_kit_share_id uuid)
returns public.kit_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _prev_status text;
  _allocated integer;
  _new_status text;
begin
  select * into _kit
  from public.kit_shares
  where id = _kit_share_id
  for update;

  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  _prev_status := _kit.status;
  _allocated := public.kit_share_allocated_total(_kit_share_id);

  if _allocated > _kit.kit_size_vials then
    raise exception 'Die Kit Verteilung ist ungültig. Die Gesamtmenge überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  _new_status := case
    when _allocated = _kit.kit_size_vials then 'full'
    else 'open'
  end;

  update public.kit_shares
  set status = _new_status,
      updated_at = now()
  where id = _kit_share_id
  returning * into _kit;

  if _new_status = 'full'
     and _prev_status is distinct from 'full'
     and public.kit_share_allocation_matches_size(_kit_share_id) then
    perform set_config('kit.skip_customer_lock', 'on', true);
    perform public.kit_share_sync_all_participant_carts(_kit_share_id);
  end if;

  return _kit;
end;
$$;

revoke all on function public.kit_share_refresh_status_locked(uuid)
  from public, anon, authenticated;

comment on function public.kit_share_refresh_status_locked(uuid) is
  'Derives open/full from participant sum vs kit_size_vials. On transition to full, syncs all open participant carts. Never mutates ordered/cancelled kits.';

-- ---------------------------------------------------------------------------
-- cart_kit_share_is_checkout_ready — fail closed on status/sum mismatch
-- ---------------------------------------------------------------------------

drop function if exists public.cart_kit_share_is_checkout_ready(uuid, uuid, integer);

create or replace function public.cart_kit_share_is_checkout_ready(
  _kit_share_id uuid,
  _user_id uuid,
  _quantity numeric
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kit_shares ks
    join public.kit_share_participants ksp
      on ksp.kit_share_id = ks.id
     and ksp.user_id = _user_id
    where ks.id = _kit_share_id
      and ks.status in ('full', 'ordered')
      and public.kit_share_allocated_total(_kit_share_id) = ks.kit_size_vials
      and ksp.quantity = _quantity
      and ksp.ordered_at is null
  );
$$;

revoke all on function public.cart_kit_share_is_checkout_ready(uuid, uuid, numeric)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_share_sync_all_participant_carts — open participants only, idempotent
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_sync_all_participant_carts(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _participant record;
begin
  perform set_config('kit.skip_customer_lock', 'on', true);

  for _participant in
    select user_id
    from public.kit_share_participants
    where kit_share_id = _kit_share_id
      and ordered_at is null
      and order_id is null
    order by user_id
  loop
    perform public.kit_share_sync_participant_cart(_kit_share_id, _participant.user_id);
  end loop;
end;
$$;

revoke all on function public.kit_share_sync_all_participant_carts(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_share_sync_participant_cart — marketplace open kits: no lines until full
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_sync_participant_cart(
  _kit_share_id uuid,
  _user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _product public.products;
  _participant public.kit_share_participants;
  _cart_id uuid;
  _position integer;
  _markup numeric;
  _unit numeric;
  _allocated integer;
  _catalog_unit numeric;
  _pack_size integer;
  _rate numeric;
  _line numeric;
  _item_id uuid;
  _existing_id uuid;
  _variant_label text;
  _normal_unit numeric;
  _bulk_unit numeric;
  _tier text;
begin
  perform set_config('kit.skip_customer_lock', 'on', true);

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return null;
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    perform set_config('kit.skip_cart_removal_tracking', 'on', true);
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id;
    perform set_config('kit.skip_cart_removal_tracking', '', true);
    return null;
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _user_id;

  if not found then
    perform set_config('kit.skip_cart_removal_tracking', 'on', true);
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id;
    perform set_config('kit.skip_cart_removal_tracking', '', true);
    return null;
  end if;

  if _participant.ordered_at is not null or _participant.order_id is not null then
    perform set_config('kit.skip_cart_removal_tracking', 'on', true);
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id
      and ci.submitted_order_id is null;
    perform set_config('kit.skip_cart_removal_tracking', '', true);
    return null;
  end if;

  if coalesce(_kit.is_open_request, false) and _kit.status <> 'full' then
    perform set_config('kit.skip_cart_removal_tracking', 'on', true);
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id
      and ci.submitted_order_id is null;
    perform set_config('kit.skip_cart_removal_tracking', '', true);
    return null;
  end if;

  if coalesce(_kit.is_open_request, false)
     and _kit.status = 'full'
     and not public.kit_share_allocation_matches_size(_kit_share_id) then
    return null;
  end if;

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null or not _product.is_active then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.products p where p.id = _product.id) then
    _product := public.apply_shop_area_product_overrides(_product, _kit.shop_area);
  end if;
  _cart_id := public.kit_share_target_cart_id(_user_id, _kit.shop_area);

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _markup := public.markup_percent_for_area(_user_id, _kit.shop_area, _product.id);
  _pack_size := public.kit_share_catalog_pack_size(_product);
  _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);
  _unit := public.apply_role_markup(_catalog_unit, _markup);

  _normal_unit := public.apply_role_markup(
    case
      when public.product_uses_kit_unit_pricing(_product) then _product.price_usd / _pack_size
      else _product.price_usd
    end,
    _markup
  );

  if public.kit_share_bulk_applies(_product, _allocated) then
    _bulk_unit := public.apply_role_markup(
      case
        when public.product_uses_kit_unit_pricing(_product) then _product.bulk_price_usd / _pack_size
        else _product.bulk_price_usd
      end,
      _markup
    );
    _tier := 'bulk';
  else
    _bulk_unit := case
      when _product.bulk_price_usd is not null then
        public.apply_role_markup(
          case
            when public.product_uses_kit_unit_pricing(_product) then _product.bulk_price_usd / _pack_size
            else _product.bulk_price_usd
          end,
          _markup
        )
      else null
    end;
    _tier := 'normal';
  end if;

  select rate into _rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'EUR'
  order by fetched_at desc nulls last
  limit 1;

  _line := round((_participant.quantity * _unit)::numeric, 2);
  _variant_label := coalesce(nullif(trim(_product.dosage_vial), ''), _product.code);

  select ci.id into _existing_id
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.kit_share_id = _kit_share_id
  limit 1;

  if _existing_id is not null then
    update public.cart_items
    set
      quantity = _participant.quantity,
      unit_price_usd_snapshot = _unit,
      normal_price_usd_snapshot = _normal_unit,
      bulk_price_usd_snapshot = _bulk_unit,
      bulk_price_min_quantity_snapshot = _product.bulk_price_min_quantity,
      applied_price_tier = _tier,
      exchange_rate_snapshot = _rate,
      eur_value_snapshot = case
        when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2)
        else null
      end,
      price_snapshot_at = now(),
      resolution_status = 'resolved',
      product_code_snapshot = _product.code,
      product_name_snapshot = _product.name,
      product_id = case
        when exists (select 1 from public.products p where p.id = _product.id) then _product.id
        else null
      end,
      vendor_code = _product.code,
      shop_area = _kit.shop_area,
      note = format(
        'Kit Anteil · %s · %s · Gemeinsames %s-Einheiten-Kit',
        _variant_label,
        _participant.quantity,
        _kit.kit_size_vials
      )
    where id = _existing_id
    returning id into _item_id;

    update public.kit_share_participants
    set cart_line_removed_at = null,
        cart_line_last_in_cart_at = now(),
        updated_at = now()
    where kit_share_id = _kit_share_id and user_id = _user_id;

    return _item_id;
  end if;

  select coalesce(max(position), -1) + 1 into _position
  from public.cart_items
  where cart_id = _cart_id;

  insert into public.cart_items (
    cart_id, position, product_id, vendor_code, product_code_input, product_code_snapshot, product_name_snapshot,
    quantity, unit_price_usd_snapshot, normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier, exchange_rate_snapshot, eur_value_snapshot,
    price_snapshot_at, resolution_status, note, kit_share_id, shop_area
  )
  values (
    _cart_id, _position,
    case when exists (select 1 from public.products p where p.id = _product.id) then _product.id else null end,
    _product.code, _product.code, _product.code, _product.name,
    _participant.quantity, _unit,
    _normal_unit,
    _bulk_unit, _product.bulk_price_min_quantity, _tier,
    _rate,
    case when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2) else null end,
    now(), 'resolved',
    format(
      'Kit Anteil · %s · %s · Gemeinsames %s-Einheiten-Kit',
      _variant_label,
      _participant.quantity,
      _kit.kit_size_vials
    ),
    _kit_share_id,
    _kit.shop_area
  )
  returning id into _item_id;

  update public.kit_share_participants
  set cart_line_removed_at = null,
      cart_line_last_in_cart_at = now(),
      updated_at = now()
  where kit_share_id = _kit_share_id and user_id = _user_id;

  return _item_id;
end;
$$;

revoke all on function public.kit_share_sync_participant_cart(uuid, uuid)
  from public, anon, authenticated;

-- 0036_fix_kit_share_catalog_unit_pricing.sql
-- Fix kit-share catalog unit pricing: bulk tier must use per-vial/per-piece rates,
-- and bulk_min for peptides counts catalog kits (10-vial packs), not individual vials.

-- ---------------------------------------------------------------------------
-- 1. product_uses_kit_unit_pricing — mirrors shopCategoryIdFor (peptides / water)
-- ---------------------------------------------------------------------------

create or replace function public.product_uses_kit_unit_pricing(_product public.products)
returns boolean
language sql
immutable
as $$
  select
    case
      when lower(trim(coalesce(_product.name, ''))) in ('bac water', 'aa water') then true
      when upper(trim(coalesce(_product.code, ''))) in ('AA10', 'BA03', 'BA10') then true
      when lower(replace(replace(trim(coalesce(_product.category, '')), '_', '-'), ' ', '-'))
           like '%reconstitution%' then true
      when lower(trim(coalesce(_product.category, ''))) like '%peptide%' then true
      when lower(trim(coalesce(_product.category, ''))) like '%oral%' then false
      when lower(trim(coalesce(_product.category, ''))) like '%oil%'
        or lower(trim(coalesce(_product.category, ''))) like '%inject%' then false
      else true
    end;
$$;

revoke all on function public.product_uses_kit_unit_pricing(public.products) from public;

-- ---------------------------------------------------------------------------
-- 2. kit_share_catalog_pack_size — units covered by one price_usd row
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_catalog_pack_size(_product public.products)
returns integer
language sql
immutable
as $$
  select case
    when public.product_uses_kit_unit_pricing(_product) then 10
    else 1
  end;
$$;

revoke all on function public.kit_share_catalog_pack_size(public.products) from public;

-- ---------------------------------------------------------------------------
-- 3. kit_share_bulk_applies — shared-kit bulk tier detection
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_bulk_applies(
  _product public.products,
  _allocated_total integer
)
returns boolean
language sql
stable
as $$
  select
    _product.bulk_price_usd is not null
    and _product.bulk_price_min_quantity is not null
    and _product.bulk_price_min_quantity > 0
    and _allocated_total > 0
    and (_allocated_total::numeric / public.kit_share_catalog_pack_size(_product))
        >= _product.bulk_price_min_quantity;
$$;

revoke all on function public.kit_share_bulk_applies(public.products, integer) from public;

-- ---------------------------------------------------------------------------
-- 4. kit_share_catalog_unit_usd — per-vial / per-piece catalog unit
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_catalog_unit_usd(
  _product public.products,
  _kit_size integer,
  _allocated_total integer
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _pack_size integer;
  _base_price numeric;
begin
  _pack_size := public.kit_share_catalog_pack_size(_product);

  if public.kit_share_bulk_applies(_product, _allocated_total) then
    _base_price := _product.bulk_price_usd;
  else
    _base_price := _product.price_usd;
  end if;

  return _base_price / _pack_size;
end;
$$;

revoke all on function public.kit_share_catalog_unit_usd(public.products, integer, integer) from public;

-- ---------------------------------------------------------------------------
-- 5. kit_share_sync_participant_cart — fix bulk tier snapshots and unit price
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
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return null;
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id;
    return null;
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _user_id;

  if not found then
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id;
    return null;
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select id into _cart_id
  from public.carts
  where user_id = _user_id
    and is_active_cart
    and deleted_at is null
    and status in ('draft', 'ready')
  limit 1;

  if _cart_id is null then
    insert into public.carts (user_id, name, status, is_active_cart)
    values (_user_id, 'Warenkorb', 'draft', true)
    returning id into _cart_id;
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _markup := public.markup_percent_for(_user_id);
  _pack_size := public.kit_share_catalog_pack_size(_product);
  _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);
  _unit := public.apply_role_markup(_catalog_unit, _markup);

  _normal_unit := public.apply_role_markup(_product.price_usd / _pack_size, _markup);

  if public.kit_share_bulk_applies(_product, _allocated) then
    _bulk_unit := public.apply_role_markup(_product.bulk_price_usd / _pack_size, _markup);
    _tier := 'bulk';
  else
    _bulk_unit := case
      when _product.bulk_price_usd is not null then
        public.apply_role_markup(_product.bulk_price_usd / _pack_size, _markup)
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
    and ci.product_id = _product.id
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
      note = format(
        'Kit Anteil · %s · %s · Gemeinsames %s-Einheiten-Kit',
        _variant_label,
        _participant.quantity,
        _kit.kit_size_vials
      )
    where id = _existing_id
    returning id into _item_id;

    return _item_id;
  end if;

  select coalesce(max(position), -1) + 1 into _position
  from public.cart_items
  where cart_id = _cart_id;

  insert into public.cart_items (
    cart_id, position, product_id, product_code_input, product_code_snapshot, product_name_snapshot,
    quantity, unit_price_usd_snapshot, normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier, exchange_rate_snapshot, eur_value_snapshot,
    price_snapshot_at, resolution_status, note, kit_share_id
  )
  values (
    _cart_id, _position, _product.id, _product.code, _product.code, _product.name,
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
    _kit_share_id
  )
  returning id into _item_id;

  return _item_id;
end;
$$;

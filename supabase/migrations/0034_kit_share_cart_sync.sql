-- 0034_kit_share_cart_sync.sql
-- Server-side kit-share cart synchronization for all participants.

-- ---------------------------------------------------------------------------
-- kit_share_sync_participant_cart — upsert one participant's cart line
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
  _catalog_vial numeric;
  _rate numeric;
  _line numeric;
  _item_id uuid;
  _existing_id uuid;
  _strength_label text;
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

  _markup := public.markup_percent_for(_user_id);
  _catalog_vial := _product.price_usd / _kit.kit_size_vials;
  _unit := public.apply_role_markup(_catalog_vial, _markup);

  select rate into _rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'EUR'
  order by fetched_at desc nulls last
  limit 1;

  _line := round((_participant.quantity * _unit)::numeric, 2);

  _strength_label := coalesce(nullif(trim(_product.dosage_vial), ''), _product.code);

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
      normal_price_usd_snapshot = _unit,
      bulk_price_usd_snapshot = null,
      bulk_price_min_quantity_snapshot = null,
      applied_price_tier = 'normal',
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
        'Kit Anteil · %s · %s Vials · Gemeinsames %s-Vial-Kit',
        _strength_label,
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
    _participant.quantity, _unit, _unit, null, null, 'normal',
    _rate,
    case when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2) else null end,
    now(), 'resolved',
    format(
      'Kit Anteil · %s · %s Vials · Gemeinsames %s-Vial-Kit',
      _strength_label,
      _participant.quantity,
      _kit.kit_size_vials
    ),
    _kit_share_id
  )
  returning id into _item_id;

  return _item_id;
end;
$$;

revoke all on function public.kit_share_sync_participant_cart(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- kit_share_sync_all_participant_carts
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
  for _participant in
    select user_id
    from public.kit_share_participants
    where kit_share_id = _kit_share_id
  loop
    perform public.kit_share_sync_participant_cart(_kit_share_id, _participant.user_id);
  end loop;
end;
$$;

revoke all on function public.kit_share_sync_all_participant_carts(uuid) from public;

-- ---------------------------------------------------------------------------
-- create_kit_share — sync creator cart after create
-- ---------------------------------------------------------------------------

create or replace function public.create_kit_share(
  _product_id uuid,
  _kit_size_vials integer,
  _my_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _allocated integer;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _kit_size_vials is null or _kit_size_vials < 2 or _kit_size_vials > 100 then
    raise exception 'Ungültige Kitgröße.' using errcode = '22023';
  end if;

  if _my_quantity is null or _my_quantity < 1 or _my_quantity > _kit_size_vials then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _product from public.products where id = _product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.kit_shares (product_id, creator_user_id, kit_size_vials, status)
  values (
    _product_id,
    _uid,
    _kit_size_vials,
    case when _my_quantity = _kit_size_vials then 'full' else 'open' end
  )
  returning * into _kit;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit.id, _uid, _my_quantity);

  _allocated := public.kit_share_allocated_total(_kit.id);

  perform public.kit_share_sync_participant_cart(_kit.id, _uid);

  return jsonb_build_object(
    'id', _kit.id,
    'productId', _product.id,
    'productName', _product.name,
    'productCode', _product.code,
    'kitSizeVials', _kit.kit_size_vials,
    'status', _kit.status,
    'allocatedTotal', _allocated,
    'remainingVials', _kit.kit_size_vials - _allocated,
    'myQuantity', _my_quantity,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit.id, _uid),
    'canAddToCart', _kit.status = 'full',
    'cartSynced', true,
    'participants', jsonb_build_array(
      jsonb_build_object('isSelf', true, 'displayName', 'Du', 'quantity', _my_quantity)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- invite_kit_share_participant — sync invitee + all when full
-- ---------------------------------------------------------------------------

create or replace function public.invite_kit_share_participant(
  _kit_share_id uuid,
  _participant_user_id uuid,
  _quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _allocated integer;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _participant_user_id = _uid then
    raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.creator_user_id <> _uid then
    raise exception 'Nur der Ersteller kann Teilnehmer hinzufügen.' using errcode = '42501';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _participant_user_id
  ) then
    raise exception 'Dieses Mitglied ist bereits Teil des Kits.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = _participant_user_id) then
    raise exception 'Mitglied wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  if _allocated + _quantity > _kit.kit_size_vials then
    raise exception 'Die gewünschte Menge überschreitet die verfügbare Kitmenge.' using errcode = 'P0001';
  end if;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit_share_id, _participant_user_id, _quantity);

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  perform public.kit_share_sync_participant_cart(_kit_share_id, _participant_user_id);
  perform public.kit_share_sync_participant_cart(_kit_share_id, _uid);

  if _kit.status = 'full' then
    perform public.kit_share_sync_all_participant_carts(_kit_share_id);
  end if;

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- update_kit_share_quantity — sync participant cart
-- ---------------------------------------------------------------------------

create or replace function public.update_kit_share_quantity(
  _kit_share_id uuid,
  _quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _others integer;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if not found then
    raise exception 'Keine Berechtigung, diese Menge zu ändern.' using errcode = '42501';
  end if;

  _others := public.kit_share_allocated_total(_kit_share_id) - _participant.quantity;
  if _others + _quantity > _kit.kit_size_vials then
    raise exception 'Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar.' using errcode = 'P0001';
  end if;

  update public.kit_share_participants
  set quantity = _quantity, updated_at = now()
  where id = _participant.id;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  perform public.kit_share_sync_participant_cart(_kit_share_id, _uid);

  if _kit.status = 'full' then
    perform public.kit_share_sync_all_participant_carts(_kit_share_id);
  end if;

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_kit_share — remove participant cart line
-- ---------------------------------------------------------------------------

create or replace function public.leave_kit_share(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if _kit.creator_user_id = _uid then
    raise exception 'Der Ersteller kann das Kit nicht verlassen. Bitte stornieren.' using errcode = 'P0001';
  end if;

  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and c.user_id = _uid
    and c.deleted_at is null
    and ci.kit_share_id = _kit_share_id;

  delete from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  perform public.kit_share_refresh_status_locked(_kit_share_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_kit_share — remove all participant cart lines
-- ---------------------------------------------------------------------------

create or replace function public.cancel_kit_share(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.creator_user_id <> _uid then
    raise exception 'Nur der Ersteller kann das Kit stornieren.' using errcode = '42501';
  end if;

  if _kit.status = 'ordered' then
    raise exception 'Dieses Kit wurde bereits bestellt.' using errcode = 'P0001';
  end if;

  delete from public.cart_items
  where kit_share_id = _kit_share_id;

  update public.kit_shares
  set status = 'cancelled', updated_at = now()
  where id = _kit_share_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_kit_share_to_cart — delegate to sync helper
-- ---------------------------------------------------------------------------

create or replace function public.add_kit_share_to_cart(_kit_share_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
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

  if not exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _uid
  ) then
    raise exception 'Keine Berechtigung für dieses Kit.' using errcode = '42501';
  end if;

  return public.kit_share_sync_participant_cart(_kit_share_id, _uid);
end;
$$;

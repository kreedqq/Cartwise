-- 0035_kit_share_distribution_and_ten_rule.sql
-- Kit sharing 2.0: 10-unit rule, bulk pricing, distribution updates, all products.

-- ---------------------------------------------------------------------------
-- 1. kit_size must be a positive multiple of 10 (10 … 100)
-- ---------------------------------------------------------------------------

alter table public.kit_shares
  drop constraint if exists kit_shares_kit_size_vials_check;

alter table public.kit_shares
  add constraint kit_shares_kit_size_vials_check
  check (
    kit_size_vials >= 10
    and kit_size_vials <= 100
    and mod(kit_size_vials, 10) = 0
  );

-- ---------------------------------------------------------------------------
-- 2. kit_share_catalog_unit_usd — per-unit catalog price for kit allocation
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
  _unit numeric;
begin
  if _product.bulk_price_usd is not null
     and _product.bulk_price_min_quantity is not null
     and _product.bulk_price_min_quantity > 0
     and _allocated_total >= _product.bulk_price_min_quantity then
    _unit := _product.bulk_price_usd;
  else
    -- Peptide / water kit price is stored per 10-unit pack.
    _unit := _product.price_usd / 10;
  end if;

  return _unit;
end;
$$;

revoke all on function public.kit_share_catalog_unit_usd(public.products, integer, integer) from public;

-- ---------------------------------------------------------------------------
-- 3. kit_share_participant_price_usd — role-aware share with bulk tier
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_participant_price_usd(
  _kit_share_id uuid,
  _user_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _product public.products;
  _qty integer;
  _allocated integer;
  _markup numeric;
  _catalog_unit numeric;
begin
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return null;
  end if;

  select quantity into _qty
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _user_id;

  if _qty is null then
    return null;
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    return null;
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _markup := public.markup_percent_for(_user_id);
  _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);

  return round(public.apply_role_markup(_catalog_unit * _qty, _markup)::numeric, 2);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. kit_share_refresh_status_locked
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_refresh_status_locked(_kit_share_id uuid)
returns public.kit_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _allocated integer;
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

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  if _allocated > _kit.kit_size_vials then
    raise exception 'Die Kit Verteilung ist ungültig. Die Gesamtmenge überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  update public.kit_shares
  set status = case
        when _allocated = _kit.kit_size_vials
         and mod(_allocated, 10) = 0
        then 'full'
        else 'open'
      end,
      updated_at = now()
  where id = _kit_share_id
  returning * into _kit;

  return _kit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. kit_share_sync_participant_cart — upsert with bulk-aware pricing
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
  _rate numeric;
  _line numeric;
  _item_id uuid;
  _existing_id uuid;
  _variant_label text;
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
  _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);
  _unit := public.apply_role_markup(_catalog_unit, _markup);

  if _product.bulk_price_usd is not null
     and _product.bulk_price_min_quantity is not null
     and _allocated >= _product.bulk_price_min_quantity then
    _bulk_unit := public.apply_role_markup(_product.bulk_price_usd, _markup);
    _tier := 'bulk';
  else
    _bulk_unit := null;
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
      normal_price_usd_snapshot = public.apply_role_markup(_product.price_usd, _markup),
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
    public.apply_role_markup(_product.price_usd, _markup),
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

-- ---------------------------------------------------------------------------
-- 6. create_kit_share
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

  if _kit_size_vials is null
     or _kit_size_vials < 10
     or _kit_size_vials > 100
     or mod(_kit_size_vials, 10) <> 0 then
    raise exception 'Ungültige Kitgröße. Die Größe muss ein Vielfaches von 10 sein.' using errcode = '22023';
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
-- 7. invite_kit_share_participant
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
-- 8. update_kit_share_quantity — single participant, sync carts
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

  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. update_kit_share_distribution — creator replaces full distribution
-- ---------------------------------------------------------------------------

create or replace function public.update_kit_share_distribution(
  _kit_share_id uuid,
  _distribution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _entry jsonb;
  _user_id uuid;
  _quantity integer;
  _total integer := 0;
  _participant_count integer;
  _distribution_count integer;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _distribution is null or jsonb_typeof(_distribution) <> 'array' then
    raise exception 'Ungültige Kit Verteilung.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.creator_user_id <> _uid then
    raise exception 'Nur der Ersteller kann die Verteilung bearbeiten.' using errcode = '42501';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  select count(*) into _participant_count
  from public.kit_share_participants
  where kit_share_id = _kit_share_id;

  _distribution_count := jsonb_array_length(_distribution);
  if _distribution_count <> _participant_count then
    raise exception 'Ungültige Kit Verteilung.' using errcode = 'P0001';
  end if;

  for _entry in select * from jsonb_array_elements(_distribution)
  loop
    _user_id := (_entry->>'userId')::uuid;
    _quantity := (_entry->>'quantity')::integer;

    if _user_id is null or _quantity is null or _quantity < 1 then
      raise exception 'Ungültige Kit Verteilung.' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.kit_share_participants
      where kit_share_id = _kit_share_id and user_id = _user_id
    ) then
      raise exception 'Ungültige Kit Verteilung.' using errcode = 'P0001';
    end if;

    _total := _total + _quantity;
  end loop;

  if _total <> _kit.kit_size_vials then
    raise exception 'Die Verteilung muss exakt der Kitgröße entsprechen.' using errcode = 'P0001';
  end if;

  if mod(_total, 10) <> 0 then
    raise exception 'Die Kit Verteilung ist ungültig. Die Gesamtmenge muss durch 10 teilbar sein.' using errcode = 'P0001';
  end if;

  for _entry in select * from jsonb_array_elements(_distribution)
  loop
    _user_id := (_entry->>'userId')::uuid;
    _quantity := (_entry->>'quantity')::integer;

    update public.kit_share_participants
    set quantity = _quantity, updated_at = now()
    where kit_share_id = _kit_share_id and user_id = _user_id;
  end loop;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);
  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

revoke all on function public.update_kit_share_distribution(uuid, jsonb) from public;
grant execute on function public.update_kit_share_distribution(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. leave_kit_share — remove cart line, reopen kit
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
-- 12. get_my_kit_share — include participant userId for creator (distribution edit)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_kit_share(_kit_share_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _my_qty integer;
  _allocated integer;
  _participants jsonb;
  _is_creator boolean;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.kit_share_participants p
    where p.kit_share_id = _kit_share_id and p.user_id = _uid
  ) then
    raise exception 'Keine Berechtigung, dieses Kit anzuzeigen.' using errcode = '42501';
  end if;

  select * into _product from public.products where id = _kit.product_id;
  _is_creator := _kit.creator_user_id = _uid;

  select quantity into _my_qty
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'isSelf', p.user_id = _uid,
        'displayName', case when p.user_id = _uid then 'Du' else coalesce(pr.display_name, 'Teilnehmer') end,
        'quantity', p.quantity
      ) || case when _is_creator then jsonb_build_object('userId', p.user_id) else '{}'::jsonb end
      order by case when p.user_id = _uid then 0 else 1 end, lower(pr.display_name)
    ),
    '[]'::jsonb
  )
  into _participants
  from public.kit_share_participants p
  left join public.profiles pr on pr.id = p.user_id
  where p.kit_share_id = _kit_share_id;

  return jsonb_build_object(
    'id', _kit.id,
    'productId', _kit.product_id,
    'productName', _product.name,
    'productCode', _product.code,
    'kitSizeVials', _kit.kit_size_vials,
    'status', _kit.status,
    'allocatedTotal', _allocated,
    'remainingVials', _kit.kit_size_vials - _allocated,
    'myQuantity', _my_qty,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit_share_id, _uid),
    'canAddToCart', _kit.status = 'full',
    'participants', _participants
  );
end;
$$;


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

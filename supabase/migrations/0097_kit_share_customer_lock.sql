-- 0097_kit_share_customer_lock.sql
-- Server-side customer lock for full / partially-ordered shared kits.
-- Preserves admin restore, sync, checkout, and admin distribution (0087).

-- ---------------------------------------------------------------------------
-- Lock SSoT (derive reason; no new kit_shares columns)
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_customer_lock_active(_kit_share_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kit_shares ks
    where ks.id = _kit_share_id
      and (
        ks.status in ('full', 'ordered')
        or exists (
          select 1
          from public.kit_share_participants p
          where p.kit_share_id = ks.id
            and p.ordered_at is not null
        )
        or exists (
          select 1
          from public.order_items oi
          where oi.kit_share_id_snapshot = ks.id
        )
      )
  );
$$;

revoke all on function public.kit_share_customer_lock_active(uuid) from public, anon, authenticated;

create or replace function public.kit_share_customer_lock_reason(_kit_share_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.kit_share_customer_lock_active(_kit_share_id) then null
    when exists (
      select 1
      from public.kit_share_participants p
      where p.kit_share_id = _kit_share_id
        and p.ordered_at is not null
    )
    or exists (
      select 1
      from public.order_items oi
      where oi.kit_share_id_snapshot = _kit_share_id
    ) then 'partial_order'
    when exists (
      select 1 from public.kit_shares ks
      where ks.id = _kit_share_id and ks.status = 'ordered'
    ) then 'ordered'
    else 'full'
  end;
$$;

revoke all on function public.kit_share_customer_lock_reason(uuid) from public, anon, authenticated;

create or replace function public.kit_share_assert_customer_may_mutate(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('kit.skip_customer_lock', true), '') = 'on' then
    return;
  end if;

  if public.kit_share_customer_lock_active(_kit_share_id) then
    raise exception 'Dieses Kit ist gesperrt und kann nicht mehr verändert werden.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.kit_share_assert_customer_may_mutate(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- cart_items: block customer kit line delete / economic updates when locked
-- ---------------------------------------------------------------------------

create or replace function public.guard_kit_cart_item_customer_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit_id uuid;
begin
  if tg_op = 'DELETE' then
    _kit_id := old.kit_share_id;
  else
    _kit_id := new.kit_share_id;
  end if;

  if _kit_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if coalesce(current_setting('kit.skip_customer_lock', true), '') = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.submitted_order_id is distinct from old.submitted_order_id
       and new.quantity is not distinct from old.quantity
       and new.kit_share_id is not distinct from old.kit_share_id
       and new.product_id is not distinct from old.product_id
       and new.vendor_code is not distinct from old.vendor_code
       and new.product_code_snapshot is not distinct from old.product_code_snapshot
    then
      return new;
    end if;
  end if;

  perform public.kit_share_assert_customer_may_mutate(_kit_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_kit_cart_item_customer_mutation() from public, anon, authenticated;

drop trigger if exists cart_items_guard_kit_customer_lock on public.cart_items;
create trigger cart_items_guard_kit_customer_lock
  before update or delete on public.cart_items
  for each row
  execute function public.guard_kit_cart_item_customer_mutation();

-- ---------------------------------------------------------------------------
-- Sync / checkout / merge / cancel: authorized cart mutations use GUC skip
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
    and (
      (exists (select 1 from public.products p where p.id = _product.id) and ci.product_id = _product.id)
      or (
        not exists (select 1 from public.products p where p.id = _product.id)
        and ci.vendor_code = _product.code
      )
    )
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

revoke all on function public.kit_share_sync_participant_cart(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Customer kit RPC guards
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
  _participant public.kit_share_participants;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered', 'expired') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  perform public.kit_share_assert_customer_may_mutate(_kit_share_id);

  if _kit.creator_user_id = _uid then
    raise exception 'Der Ersteller kann das Kit nicht verlassen. Bitte stornieren.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if found and _participant.ordered_at is not null then
    raise exception 'Du hast diesen Kit-Anteil bereits bestellt und kannst das Kit nicht mehr verlassen.' using errcode = 'P0001';
  end if;

  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('kit.skip_cart_removal_tracking', 'on', true);

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
  _is_request boolean;
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

  _is_request := coalesce(_kit.is_open_request, false);

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if _is_request and _kit.status <> 'open' then
    raise exception 'Dieses Kit-Gesuch kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if not _is_request then
    perform public.kit_share_assert_customer_may_mutate(_kit_share_id);
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if not found then
    raise exception 'Keine Berechtigung, diese Menge zu ändern.' using errcode = '42501';
  end if;

  if _participant.ordered_at is not null then
    raise exception 'Deine Bestellung für dieses Kit wurde bereits abgeschlossen und kann nicht mehr geändert werden.' using errcode = 'P0001';
  end if;

  _others := public.kit_share_allocated_total(_kit_share_id) - _participant.quantity;
  if _others + _quantity > _kit.kit_size_vials then
    raise exception 'Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar.' using errcode = 'P0001';
  end if;

  if _is_request then
    perform set_config('peptix.allow_kit_request_join', '1', true);
  end if;

  update public.kit_share_participants
  set quantity = _quantity, updated_at = now()
  where id = _participant.id;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  if _is_request then
    if _kit.status = 'full' then
      perform public.kit_share_sync_all_participant_carts(_kit_share_id);
      update public.kit_shares
      set completed_at = coalesce(completed_at, now()), updated_at = now()
      where id = _kit_share_id
      returning * into _kit;
    end if;
  else
    perform public.kit_share_sync_all_participant_carts(_kit_share_id);
  end if;

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

revoke all on function public.update_kit_share_quantity(uuid, integer) from public, anon;
grant execute on function public.update_kit_share_quantity(uuid, integer) to authenticated;

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

  perform public.kit_share_assert_customer_may_mutate(_kit_share_id);

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

revoke all on function public.invite_kit_share_participant(uuid, uuid, integer) from public;
grant execute on function public.invite_kit_share_participant(uuid, uuid, integer) to authenticated;

create or replace function public.remove_kit_share_participant(
  _kit_share_id uuid,
  _participant_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _target public.kit_share_participants;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.creator_user_id <> _uid then
    raise exception 'Nur der Ersteller kann Teilnehmer entfernen.' using errcode = '42501';
  end if;

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  perform public.kit_share_assert_customer_may_mutate(_kit_share_id);

  if _participant_user_id = _kit.creator_user_id then
    raise exception 'Der Ersteller kann sich nicht selbst entfernen. Bitte stornieren.' using errcode = 'P0001';
  end if;

  select * into _target
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  if not found then
    raise exception 'Dieser Teilnehmer ist nicht Teil des Kits.' using errcode = 'P0002';
  end if;

  if _target.ordered_at is not null then
    raise exception 'Dieser Teilnehmer hat bereits bestellt und kann nicht mehr entfernt werden.' using errcode = 'P0001';
  end if;

  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('kit.skip_cart_removal_tracking', 'on', true);

  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and c.user_id = _participant_user_id
    and c.deleted_at is null
    and ci.kit_share_id = _kit_share_id;

  delete from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);
  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

revoke all on function public.remove_kit_share_participant(uuid, uuid) from public;
grant execute on function public.remove_kit_share_participant(uuid, uuid) to authenticated;

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
  _existing public.kit_share_participants;
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

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  perform public.kit_share_assert_customer_may_mutate(_kit_share_id);

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

    select * into _existing
    from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _user_id;

    if not found then
      raise exception 'Ungültige Kit Verteilung.' using errcode = 'P0001';
    end if;

    if _existing.ordered_at is not null and _existing.quantity <> _quantity then
      raise exception 'Ein Teilnehmer hat seine Bestellung bereits abgeschlossen; seine Menge ist ein fester Bestellwert und kann nicht mehr geändert werden.' using errcode = 'P0001';
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

  if coalesce(_kit.is_open_request, false) and _kit.status in ('full', 'expired') then
    raise exception 'Ein abgeschlossenes oder abgelaufenes Kit-Gesuch kann nicht mehr storniert werden.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and ordered_at is not null
  ) then
    raise exception 'Mindestens ein Teilnehmer hat bereits bestellt; dieses Kit kann nicht mehr storniert werden.' using errcode = 'P0001';
  end if;

  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('kit.skip_cart_removal_tracking', 'on', true);

  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and ci.kit_share_id = _kit_share_id
    and c.status <> 'ordered';

  update public.kit_shares
  set status = 'cancelled', updated_at = now()
  where id = _kit_share_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_kit_share + admin_get_kit_request: expose lock state to UI
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
  _my_ordered boolean;
  _allocated integer;
  _participants jsonb;
  _is_creator boolean;
  _presence text;
  _locked boolean;
  _lock_reason text;
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

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _is_creator := _kit.creator_user_id = _uid;

  select quantity, (ordered_at is not null) into _my_qty, _my_ordered
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _presence := public.kit_participant_cart_presence(_kit_share_id, _uid);
  _locked := public.kit_share_customer_lock_active(_kit_share_id);
  _lock_reason := public.kit_share_customer_lock_reason(_kit_share_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'isSelf', p.user_id = _uid,
        'displayName', case
          when p.user_id = _uid then 'Du'
          else coalesce(pr.username, 'Teilnehmer')
        end,
        'quantity', p.quantity,
        'hasOrdered', p.ordered_at is not null
      ) || case when _is_creator then jsonb_build_object('userId', p.user_id) else '{}'::jsonb end
      order by case when p.user_id = _uid then 0 else 1 end, lower(coalesce(pr.username, ''))
    ),
    '[]'::jsonb
  )
  into _participants
  from public.kit_share_participants p
  left join public.profiles pr on pr.id = p.user_id
  where p.kit_share_id = _kit_share_id;

  return jsonb_build_object(
    'id', _kit.id,
    'productId', coalesce(public.kit_request_catalog_id(_kit), _product.id),
    'productName', _product.name,
    'productCode', _product.code,
    'kitSizeVials', _kit.kit_size_vials,
    'status', _kit.status,
    'allocatedTotal', _allocated,
    'remainingVials', _kit.kit_size_vials - _allocated,
    'myQuantity', _my_qty,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit_share_id, _uid),
    'canAddToCart', _kit.status = 'full',
    'isCreator', _is_creator,
    'myHasOrdered', coalesce(_my_ordered, false),
    'myCartPresence', _presence,
    'myCanRestoreCartLine', (_presence = 'removed_from_cart'),
    'customerMutationLocked', coalesce(_locked, false),
    'customerLockReason', _lock_reason,
    'participants', coalesce(_participants, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_kit_share(uuid) from public, anon;
grant execute on function public.get_my_kit_share(uuid) to authenticated;

create or replace function public.admin_get_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _base jsonb;
  _participants jsonb := '[]'::jsonb;
  _any_ordered boolean := false;
  _cart_lines integer := 0;
  _has_submitted_cart boolean := false;
  _editable boolean;
  _locked boolean;
  _lock_reason text;
begin
  _uid := public.assert_admin_kit_request();
  perform public.kit_request_expire_overdue();

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _base := public.admin_kit_request_list_item(_kit);
  _locked := public.kit_share_customer_lock_active(_kit.id);
  _lock_reason := public.kit_share_customer_lock_reason(_kit.id);

  select exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id and (ordered_at is not null or order_id is not null)
  ) into _any_ordered;

  select count(*)::integer into _cart_lines
  from public.cart_items
  where kit_share_id = _kit.id;

  select exists (
    select 1 from public.cart_items
    where kit_share_id = _kit.id and submitted_order_id is not null
  ) into _has_submitted_cart;

  _editable := _kit.status in ('open', 'full')
    and not coalesce(_any_ordered, false)
    and not coalesce(_has_submitted_cart, false);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', p.user_id,
        'username', coalesce(nullif(trim(pr.username), ''), 'Teilnehmer'),
        'quantity', p.quantity,
        'joinedAt', p.created_at,
        'updatedAt', p.updated_at,
        'hasOrdered', p.ordered_at is not null,
        'orderedAt', p.ordered_at,
        'orderId', p.order_id,
        'isCreator', p.user_id = _kit.creator_user_id,
        'hasCartItem', exists (
          select 1 from public.cart_items ci
          where ci.kit_share_id = _kit.id
            and exists (
              select 1 from public.carts c
              where c.id = ci.cart_id
                and c.user_id = p.user_id
                and c.deleted_at is null
            )
        )
      )
      order by case when p.user_id = _kit.creator_user_id then 0 else 1 end,
               p.created_at asc
    ),
    '[]'::jsonb
  )
  into _participants
  from public.kit_share_participants p
  left join public.profiles pr on pr.id = p.user_id
  where p.kit_share_id = _kit.id;

  return _base || jsonb_build_object(
    'participants', coalesce(_participants, '[]'::jsonb),
    'anyParticipantOrdered', coalesce(_any_ordered, false),
    'cartLineCount', coalesce(_cart_lines, 0),
    'customerMutationLocked', coalesce(_locked, false),
    'customerLockReason', _lock_reason,
    'canEditMeta', _kit.status in ('open', 'full', 'expired'),
    'canEditQuantities', _editable,
    'canEditDistribution', _editable,
    'canCancel', _kit.status = 'open' and not coalesce(_any_ordered, false),
    'canDelete', _kit.status in ('open', 'full', 'cancelled', 'expired')
      and not coalesce(_any_ordered, false)
      and not coalesce(_has_submitted_cart, false),
    'canChangeProduct', false
  );
end;
$$;

revoke all on function public.admin_get_kit_request(uuid) from public, anon;
grant execute on function public.admin_get_kit_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_kit_request_distribution: skip customer lock on cart/participant ops
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_kit_request_distribution(
  _kit_share_id uuid,
  _allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _before jsonb;
  _after jsonb;
  _row jsonb;
  _user_id uuid;
  _qty integer;
  _total integer := 0;
  _seen uuid[] := '{}'::uuid[];
  _existing public.kit_share_participants;
  _was_full boolean;
  _now_full boolean;
begin
  _uid := public.assert_admin_kit_request();

  if _allocations is null or jsonb_typeof(_allocations) <> 'array' then
    raise exception 'Ungültige Verteilung.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit wurde bereits storniert.' using errcode = 'P0001';
  end if;
  if _kit.status = 'expired' then
    raise exception 'Dieses Kit-Gesuch ist abgelaufen.' using errcode = 'P0001';
  end if;
  if _kit.status = 'ordered' then
    raise exception 'Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id
      and (ordered_at is not null or order_id is not null)
  ) then
    raise exception 'Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    where ci.kit_share_id = _kit.id
      and ci.submitted_order_id is not null
  ) then
    raise exception 'Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.'
      using errcode = 'P0001';
  end if;

  _before := public.admin_get_kit_request(_kit.id);
  _was_full := _kit.status = 'full';

  for _row in select value from jsonb_array_elements(_allocations)
  loop
    begin
      _user_id := (_row->>'userId')::uuid;
    exception when others then
      raise exception 'Ungültige Benutzer-ID in der Verteilung.' using errcode = '22023';
    end;
    if _user_id is null then
      raise exception 'Ungültige Benutzer-ID in der Verteilung.' using errcode = '22023';
    end if;
    if _user_id = any (_seen) then
      raise exception 'Dieser Benutzer ist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
    end if;
    _seen := array_append(_seen, _user_id);

    begin
      _qty := (_row->>'quantity')::integer;
    exception when others then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end;
    if _qty is null or _qty < 1 then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.profiles p where p.id = _user_id and nullif(btrim(p.username), '') is not null) then
      raise exception 'Benutzer wurde nicht gefunden oder hat keinen Benutzernamen.' using errcode = 'P0002';
    end if;
    _total := _total + _qty;
  end loop;

  if _total > _kit.kit_size_vials then
    raise exception 'Die neue Verteilung überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  perform set_config('peptix.allow_kit_request_join', '1', true);
  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('kit.skip_cart_removal_tracking', 'on', true);

  for _existing in
    select * from public.kit_share_participants where kit_share_id = _kit.id
  loop
    if not (_existing.user_id = any (_seen)) then
      delete from public.cart_items ci
      using public.carts c
      where ci.cart_id = c.id
        and c.user_id = _existing.user_id
        and c.deleted_at is null
        and ci.kit_share_id = _kit.id
        and ci.submitted_order_id is null;

      delete from public.kit_share_participants
      where id = _existing.id;
    end if;
  end loop;

  for _row in select value from jsonb_array_elements(_allocations)
  loop
    _user_id := (_row->>'userId')::uuid;
    _qty := (_row->>'quantity')::integer;

    update public.kit_share_participants
    set quantity = _qty, updated_at = now()
    where kit_share_id = _kit.id and user_id = _user_id;

    if not found then
      insert into public.kit_share_participants (kit_share_id, user_id, quantity)
      values (_kit.id, _user_id, _qty);
    end if;
  end loop;

  _total := public.kit_share_allocated_total(_kit.id);
  if _total > _kit.kit_size_vials then
    raise exception 'Die neue Verteilung überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  _now_full := _total = _kit.kit_size_vials and mod(_total, 10) = 0;

  update public.kit_shares
  set
    status = case when _now_full then 'full' else 'open' end,
    completed_at = case
      when _now_full then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = _kit.id
  returning * into _kit;

  if _now_full then
    perform public.kit_share_sync_all_participant_carts(_kit.id);
  else
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and ci.kit_share_id = _kit.id
      and ci.submitted_order_id is null
      and c.deleted_at is null;
  end if;

  _after := public.admin_get_kit_request(_kit.id);

  perform public.log_audit(
    _uid,
    'kit_request.admin_distribution_update',
    'kit_share',
    _kit.id,
    jsonb_build_object(
      'status', _before->>'status',
      'allocatedTotal', _before->>'allocatedTotal',
      'participants', _before->'participants'
    ),
    jsonb_build_object(
      'status', _after->>'status',
      'allocatedTotal', _after->>'allocatedTotal',
      'participants', _after->'participants',
      'wasFull', _was_full,
      'nowFull', _now_full
    )
  );

  return _after;
end;
$$;

revoke all on function public.admin_set_kit_request_distribution(uuid, jsonb)
  from public, anon;
grant execute on function public.admin_set_kit_request_distribution(uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- merge_open_carts_for_user: moving kit lines must bypass customer lock
-- ---------------------------------------------------------------------------

create or replace function public.merge_open_carts_for_user(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _canonical public.carts;
  _donor record;
  _src record;
  _dst record;
  _moved integer := 0;
  _merged integer := 0;
  _donors integer := 0;
  _max_pos integer;
begin
  perform pg_advisory_xact_lock(8700070, hashtext(_user_id::text));
  perform set_config('kit.skip_customer_lock', 'on', true);

  select * into _canonical
  from public.carts
  where user_id = _user_id
    and deleted_at is null
    and status in ('draft', 'ready')
  order by is_active_cart desc, created_at asc, id asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('userId', _user_id, 'canonicalCartId', null, 'donors', 0, 'moved', 0, 'merged', 0);
  end if;

  select coalesce(max(position), -1) into _max_pos
  from public.cart_items
  where cart_id = _canonical.id;

  for _donor in
    select *
    from public.carts
    where user_id = _user_id
      and deleted_at is null
      and status in ('draft', 'ready')
      and id <> _canonical.id
    order by created_at, id
    for update
  loop
    _donors := _donors + 1;
    for _src in
      select * from public.cart_items where cart_id = _donor.id order by position, id
    loop
      if _src.kit_share_id is not null then
        update public.cart_items
        set cart_id = _canonical.id,
            position = _max_pos + 1,
            shop_area = coalesce(_src.shop_area, _donor.shop_area, 'shop'),
            updated_at = now()
        where id = _src.id;
        _max_pos := _max_pos + 1;
        _moved := _moved + 1;
        continue;
      end if;

      select * into _dst
      from public.cart_items ci
      where ci.cart_id = _canonical.id
        and ci.kit_share_id is null
        and public.cart_item_merge_key(
              ci.kit_share_id, ci.shop_area, ci.vendor_code,
              ci.product_code_snapshot, ci.product_code_input, ci.product_id
            ) = public.cart_item_merge_key(
              _src.kit_share_id, _src.shop_area, _src.vendor_code,
              _src.product_code_snapshot, _src.product_code_input, _src.product_id
            )
      order by ci.position, ci.id
      limit 1;

      if found then
        update public.cart_items
        set quantity = _dst.quantity + _src.quantity,
            version = _dst.version + 1,
            updated_at = now()
        where id = _dst.id;
        delete from public.cart_items where id = _src.id;
        _merged := _merged + 1;
      else
        update public.cart_items
        set cart_id = _canonical.id,
            position = _max_pos + 1,
            shop_area = coalesce(_src.shop_area, _donor.shop_area, 'shop'),
            updated_at = now()
        where id = _src.id;
        _max_pos := _max_pos + 1;
        _moved := _moved + 1;
      end if;
    end loop;

    update public.carts
    set deleted_at = now(),
        is_active_cart = false,
        status = 'archived',
        updated_at = now()
    where id = _donor.id;
  end loop;

  update public.carts
  set is_active_cart = true,
      name = public.cart_title(coalesce((select nullif(trim(username), '') from public.profiles where id = _user_id), ''), 1)
  where id = _canonical.id;

  perform public.refresh_cart_selling_prices_for_user(_canonical.id, _user_id);

  return jsonb_build_object(
    'userId', _user_id,
    'canonicalCartId', _canonical.id,
    'donors', _donors,
    'moved', _moved,
    'merged', _merged
  );
end;
$$;

revoke all on function public.merge_open_carts_for_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_one_area_order: checkout may mark kit cart lines submitted
-- ---------------------------------------------------------------------------

create or replace function public.create_one_area_order(
  _cart_id                     uuid,
  _area                        text,
  _note                        text,
  _payment_method              text,
  _shipping_first_name         text,
  _shipping_last_name          text,
  _shipping_street             text,
  _shipping_house_number       text,
  _shipping_address_extra      text,
  _shipping_postal_code        text,
  _shipping_city               text,
  _shipping_country            text,
  _shipping_delivery_method    text,
  _shipping_packstation_number text,
  _shipping_post_number        text,
  _telegram                    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart                 record;
  _area_factor          numeric := 1.0;
  _item                 record;
  _product              public.products;
  _product_row          public.products;
  _p_for_bulk           public.products;
  _order_id             uuid;
  _order_item_id        uuid;
  _order_number         text;
  _position             int  := 0;
  _line_total           numeric(12, 2);
  _total_usd            numeric(14, 2) := 0;
  _total_eur            numeric(14, 2) := 0;
  _eur_complete         boolean        := true;
  _line_count           int;
  _rate                 numeric(12, 6);
  _markup               numeric;
  _sell                 numeric;
  _normal               numeric;
  _bulk                 numeric;
  _tier                 text;
  _eur                  numeric;
  _kit                  public.kit_shares;
  _kit_participant      public.kit_share_participants;
  _kit_share_ids        uuid[];
  _kit_share_id         uuid;
  _remaining_unordered  int;
  _role_name            text;
  _catalog_unit         numeric;
  _base_line            numeric(12, 2);
  _allocated            integer;
  _code                 text;
  _master_id            uuid;
  _item_area            text;
begin
  perform set_config('kit.skip_customer_lock', 'on', true);

  select * into _cart
  from public.carts
  where id = _cart_id
  for update;

  if not public.user_can_access_shop_area(auth.uid(), _area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = _area;
  _area_factor := coalesce(_area_factor, 1.0);

  select count(*) into _line_count
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.quantity > 0
    and ci.submitted_order_id is null
    and public.cart_item_shop_area(ci.shop_area, _cart.shop_area) = _area
    and (
      (
        ci.kit_share_id is not null
        and public.cart_kit_share_is_checkout_ready(ci.kit_share_id, auth.uid(), ci.quantity)
      )
      or (
        ci.kit_share_id is null
        and exists (
          select 1
          from public.shop_area_products sap
          where sap.shop_area_key = _area
            and sap.is_active
            and (
              sap.vendor_code = upper(btrim(coalesce(
                ci.vendor_code, ci.product_code_snapshot, ci.product_code_input, ''
              )))
              or (
                ci.product_id is not null
                and (sap.product_id = ci.product_id or sap.id = ci.product_id)
              )
            )
        )
      )
    );

  if _line_count = 0 then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  _markup    := public.markup_percent_for(auth.uid());
  _role_name := public.customer_role_name_for(auth.uid());

  insert into public.orders (
    user_id, cart_id, status, note, payment_method,
    telegram_username_snapshot,
    shipping_delivery_method,
    shipping_first_name, shipping_last_name, shipping_street, shipping_house_number,
    shipping_address_extra, shipping_packstation_number, shipping_post_number,
    shipping_postal_code, shipping_city, shipping_country,
    total_usd, total_eur, exchange_rate, submitted_at,
    shop_area
  )
  values (
    auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), _payment_method,
    _telegram,
    _shipping_delivery_method,
    _shipping_first_name, _shipping_last_name, _shipping_street, _shipping_house_number,
    _shipping_address_extra, _shipping_packstation_number, _shipping_post_number,
    _shipping_postal_code, _shipping_city, _shipping_country,
    0, null, null, now(),
    _area
  )
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*
    from public.cart_items ci
    where ci.cart_id = _cart_id
      and ci.quantity > 0
      and ci.submitted_order_id is null
      and public.cart_item_shop_area(ci.shop_area, _cart.shop_area) = _area
    order by ci.position
  loop
    _item_area := public.cart_item_shop_area(_item.shop_area, _cart.shop_area);
    _code := coalesce(
      nullif(btrim(coalesce(_item.vendor_code, '')), ''),
      nullif(btrim(coalesce(_item.product_code_snapshot, '')), ''),
      nullif(btrim(coalesce(_item.product_code_input, '')), '')
    );

    if _item.kit_share_id is not null then
      if not public.cart_kit_share_is_checkout_ready(_item.kit_share_id, auth.uid(), _item.quantity) then
        continue;
      end if;

      select * into _kit from public.kit_shares where id = _item.kit_share_id for update;
      if not found then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      _product := public.kit_share_catalog_product(_kit);
      if _product.id is null or not _product.is_active then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      if public.shop_area_pricing_profile(_item_area) = 'retail' then
        raise exception 'Kits sind in diesem Shop-Bereich nicht verfügbar.' using errcode = 'P0001';
      end if;

      if _kit.status not in ('full', 'ordered') then
        continue;
      end if;

      select * into _kit_participant
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id and user_id = auth.uid()
      for update;

      if not found or _kit_participant.quantity <> _item.quantity then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      if _kit_participant.ordered_at is not null then
        continue;
      end if;

      _sell   := _item.unit_price_usd_snapshot;
      _normal := _sell;
      _bulk   := null;
      _tier   := 'normal';

      update public.kit_share_participants
      set ordered_at = now(), order_id = _order_id, updated_at = now()
      where id = _kit_participant.id;

      if not (_item.kit_share_id = any(coalesce(_kit_share_ids, array[]::uuid[]))) then
        _kit_share_ids := coalesce(_kit_share_ids, array[]::uuid[]) || _item.kit_share_id;
      end if;
    else
      _product := public.resolve_area_catalog_product(_item_area, _code, _item.product_id);
      if _product.id is null then
        raise exception 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog.'
          using errcode = 'P0002';
      end if;

      _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _item_area);
      _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, _item_area);

      if public.shop_area_pricing_profile(_item_area) = 'retail'
         and public.product_uses_kit_unit_pricing(_product) then
        _bulk := null;
        _tier := 'normal';
      elsif public.quantity_discounts_enabled()
            and _product.bulk_price_usd is not null
            and _product.bulk_price_min_quantity is not null
            and _product.bulk_price_min_quantity > 0 then
        _p_for_bulk := public.apply_shop_area_product_overrides(_product, _item_area);
        _bulk := public.apply_role_markup(
          public.catalog_bulk_unit_price(
            _p_for_bulk.price_usd,
            _p_for_bulk.bulk_price_usd,
            _p_for_bulk.bulk_price_min_quantity
          ) * _area_factor,
          _markup
        );
        _tier := case
          when _item.quantity >= _product.bulk_price_min_quantity then 'bulk'
          else 'normal'
        end;
      else
        _bulk := null;
        _tier := 'normal';
      end if;
    end if;

    _line_total    := round((_item.quantity * _sell)::numeric, 2);
    _total_usd     := _total_usd + _line_total;

    _rate := _item.exchange_rate_snapshot;
    if _rate is not null and _rate > 0 then
      _eur       := round((_line_total * _rate)::numeric, 2);
      _total_eur := _total_eur + _eur;
    else
      _eur          := null;
      _eur_complete := false;
    end if;

    select sap.product_id into _master_id
    from public.shop_area_products sap
    where sap.shop_area_key = _item_area
      and sap.vendor_code = _product.code
    limit 1;
    if _item.kit_share_id is not null then
      _master_id := _kit.product_id;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _master_id,
      case when _item.kit_share_id is not null then _item.kit_share_id else null end,
      case when _item.kit_share_id is not null then _kit.kit_size_vials else null end,
      case when _item.kit_share_id is not null then _kit_participant.quantity else null end,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, case when public.quantity_discounts_enabled() then _product.bulk_price_min_quantity else null end,
      _tier, _sell, _item.quantity, _line_total,
      _rate, _eur
    )
    returning id into _order_item_id;

    if _item.kit_share_id is not null then
      select coalesce(sum(quantity), 0)::integer into _allocated
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id;
      if exists (select 1 from public.products p where p.id = _product.id) then
        select * into _product_row from public.products where id = _product.id;
        _catalog_unit := public.kit_share_catalog_unit_usd(_product_row, _kit.kit_size_vials, _allocated);
      else
        _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);
      end if;
    else
      _catalog_unit := public.shop_area_catalog_unit(_product, _item.quantity, _item_area);
    end if;

    _base_line := round((_item.quantity * _catalog_unit)::numeric, 2);

    insert into public.order_role_surcharge_lines (
      order_item_id, order_id,
      catalog_unit_price_usd, selling_unit_price_usd, quantity,
      base_line_usd, selling_line_usd, surcharge_usd,
      customer_role_name_snapshot
    )
    values (
      _order_item_id, _order_id,
      _catalog_unit, _sell, _item.quantity,
      _base_line, _line_total, round((_line_total - _base_line)::numeric, 2),
      _role_name
    );

    update public.cart_items
    set submitted_order_id = _order_id, updated_at = now()
    where id = _item.id;

    _position := _position + 1;
  end loop;

  if _position = 0 then
    delete from public.orders where id = _order_id;
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  update public.orders
  set total_usd  = _total_usd,
      total_eur  = case when _eur_complete then _total_eur else null end,
      exchange_rate = _rate
  where id = _order_id;

  if _kit_share_ids is not null then
    foreach _kit_share_id in array _kit_share_ids
    loop
      select count(*) into _remaining_unordered
      from public.kit_share_participants
      where kit_share_id = _kit_share_id and ordered_at is null;

      if _remaining_unordered = 0 then
        update public.kit_shares
        set status = 'ordered', updated_at = now()
        where id = _kit_share_id;
      end if;
    end loop;
  end if;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber',   _order_number,
      'totalUsd',      _total_usd,
      'itemCount',     _position,
      'paymentMethod', _payment_method,
      'deliveryMethod', _shipping_delivery_method,
      'shopArea',      _area
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd, 'shopArea', _area);
end;
$$;

revoke all on function public.create_one_area_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;

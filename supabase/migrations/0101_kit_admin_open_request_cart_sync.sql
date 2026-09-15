-- 0101: preserve 0096 admin not_in_cart restore on open kit requests after 0100 sync guard.

create or replace function public.restore_kit_share_cart_line(
  _kit_share_id uuid,
  _participant_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := auth.uid();
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _item_id uuid;
  _admin_not_in_cart boolean := false;
begin
  if _actor is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _participant_user_id is null or _kit_share_id is null then
    raise exception 'Ungültige Parameter.' using errcode = '22023';
  end if;

  if _actor is distinct from _participant_user_id
     and not public.has_role(_actor, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr in den Warenkorb gelegt werden.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id
  for update;

  if not found then
    raise exception 'Kit-Teilnehmer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _participant.ordered_at is not null or _participant.order_id is not null then
    raise exception 'Bestellte Kit-Anteile können nicht wiederhergestellt werden.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id and c.deleted_at is null
    where c.user_id = _participant_user_id
      and ci.kit_share_id = _kit_share_id
  ) then
    update public.kit_share_participants
    set cart_line_removed_at = null,
        cart_line_last_in_cart_at = coalesce(cart_line_last_in_cart_at, now()),
        updated_at = now()
    where id = _participant.id;

    perform public.log_audit(
      _actor,
      'kit_cart.restore',
      'kit_share',
      _kit_share_id,
      null,
      jsonb_build_object(
        'participantUserId', _participant_user_id,
        'alreadyInCart', true
      )
    );

    return jsonb_build_object('kitShareId', _kit_share_id, 'alreadyInCart', true);
  end if;

  if _participant.cart_line_removed_at is null then
    if not public.has_role(_actor, 'admin') then
      raise exception 'Für diesen Teilnehmer ist kein entfernter Kit-Anteil hinterlegt.' using errcode = 'P0001';
    end if;
    _admin_not_in_cart := true;
  end if;

  if _admin_not_in_cart then
    perform set_config('kit.allow_open_request_cart_sync', 'on', true);
  end if;

  _item_id := public.kit_share_sync_participant_cart(_kit_share_id, _participant_user_id);
  if _item_id is null then
    raise exception 'Kit-Anteil konnte nicht in den Warenkorb gelegt werden.' using errcode = 'P0001';
  end if;

  perform public.log_audit(
    _actor,
    'kit_cart.restore',
    'kit_share',
    _kit_share_id,
    null,
    jsonb_build_object(
      'participantUserId', _participant_user_id,
      'cartItemId', _item_id,
      'quantity', _participant.quantity,
      'adminNotInCart', _admin_not_in_cart
    )
  );

  return jsonb_build_object(
    'kitShareId', _kit_share_id,
    'cartItemId', _item_id,
    'restored', true,
    'adminNotInCart', _admin_not_in_cart
  );
end;
$$;

revoke all on function public.restore_kit_share_cart_line(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.restore_kit_share_cart_line(uuid, uuid)
  to authenticated;

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
  _allow_open_sync boolean;
begin
  perform set_config('kit.skip_customer_lock', 'on', true);

  _allow_open_sync := coalesce(current_setting('kit.allow_open_request_cart_sync', true), '') = 'on';

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

  if coalesce(_kit.is_open_request, false) and _kit.status <> 'full' and not _allow_open_sync then
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

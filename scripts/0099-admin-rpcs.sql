-- ---------------------------------------------------------------------------
-- Admin customer context + catalog (priced for target user)
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_customer_checkout_context(_customer_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _username text;
  _role_name text;
  _markup numeric;
begin
  _admin := public.assert_admin_authenticated();
  if _customer_user_id is null then
    raise exception 'Benutzer fehlt.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = _customer_user_id) then
    raise exception 'Benutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select nullif(trim(p.username), '') into _username
  from public.profiles p
  where p.id = _customer_user_id;

  _role_name := public.customer_role_name_for(_customer_user_id);
  _markup := public.markup_percent_for(_customer_user_id);

  return jsonb_build_object(
    'userId', _customer_user_id,
    'username', _username,
    'roleName', _role_name,
    'markupPercent', _markup,
    'requestedByAdminId', _admin
  );
end;
$$;

revoke all on function public.admin_get_customer_checkout_context(uuid) from public, anon;
grant execute on function public.admin_get_customer_checkout_context(uuid) to authenticated;

create or replace function public.admin_list_shop_products_for_customer(
  _shop_area text,
  _customer_user_id uuid
)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _area public.shop_areas;
  _p public.products;
  _src public.products;
  _pct numeric;
  _factor numeric;
  _divisor numeric;
  _catalog_unit numeric;
  _src_price numeric;
  _src_bulk numeric;
  _discounts boolean;
begin
  perform public.assert_admin_authenticated();
  if _customer_user_id is null then
    raise exception 'Benutzer fehlt.' using errcode = '22023';
  end if;
  _uid := _customer_user_id;

  select * into _area from public.shop_areas where key = _shop_area and is_active;
  if not found then
    raise exception 'Unbekannter oder inaktiver Shop-Bereich.' using errcode = 'P0001';
  end if;

  if not public.user_can_access_shop_area(_uid, _shop_area) then
    raise exception 'Kunde hat keinen Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  _factor := _area.base_price_factor_pct / 100.0;
  _divisor := _area.kit_unit_divisor;
  _discounts := public.quantity_discounts_enabled();

  for _src in
    select * from public.products p
    where p.is_active = true
      and public.product_visible_in_shop_area(p.id, _shop_area)
    order by p.code
  loop
    _p := public.apply_shop_area_product_overrides(_src, _shop_area);
    _pct := public.markup_percent_for_area(_uid, _shop_area, _p.id);
    _src_price := _p.price_usd;
    _src_bulk := _p.bulk_price_usd;

    if not _discounts then
      _src_bulk := null;
      _p.bulk_price_usd := null;
      _p.bulk_price_min_quantity := null;
    end if;

    if _area.pricing_profile = 'group_buy' then
      _p.price_usd := public.apply_role_markup(_src_price * _factor, _pct)::numeric(12, 4);
      if _discounts
         and _src_bulk is not null
         and _p.bulk_price_min_quantity is not null
         and _p.bulk_price_min_quantity > 0 then
        _p.bulk_price_usd := public.apply_role_markup(
          public.catalog_bulk_unit_price(_src_price, _src_bulk, _p.bulk_price_min_quantity) * _factor,
          _pct
        )::numeric(12, 4);
      else
        _p.bulk_price_usd := null;
        _p.bulk_price_min_quantity := null;
      end if;
    else
      if public.product_uses_kit_unit_pricing(_p) then
        _catalog_unit := (_src_price / _divisor) * _factor;
      else
        _catalog_unit := public.sell_unit_price(
          _src_price, _src_bulk, _p.bulk_price_min_quantity, 1, 0
        ) * _factor;
      end if;
      _p.price_usd := public.apply_role_markup(_catalog_unit, _pct)::numeric(12, 4);
      _p.bulk_price_usd := null;
      _p.bulk_price_min_quantity := null;
    end if;
    return next _p;
  end loop;
end;
$$;

revoke all on function public.admin_list_shop_products_for_customer(text, uuid) from public, anon;
grant execute on function public.admin_list_shop_products_for_customer(text, uuid) to authenticated;

create or replace function public.admin_list_customer_kit_checkout_options(
  _customer_user_id uuid,
  _shop_area text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _items jsonb := '[]'::jsonb;
begin
  perform public.assert_admin_authenticated();
  if _customer_user_id is null then
    raise exception 'Benutzer fehlt.' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kitShareId', ks.id,
        'shopArea', ks.shop_area,
        'status', ks.status,
        'kitSizeVials', ks.kit_size_vials,
        'participantQuantity', ksp.quantity,
        'productName', coalesce(pr.name, ks.vendor_code),
        'productCode', coalesce(pr.code, ks.vendor_code),
        'variantLabel', coalesce(nullif(trim(pr.dosage_vial), ''), pr.code, ks.vendor_code),
        'checkoutReady', public.cart_kit_share_is_checkout_ready(ks.id, _customer_user_id, ksp.quantity)
      )
      order by ks.updated_at desc
    ),
    '[]'::jsonb
  )
  into _items
  from public.kit_share_participants ksp
  join public.kit_shares ks on ks.id = ksp.kit_share_id
  left join public.products pr on pr.id = ks.product_id
  where ksp.user_id = _customer_user_id
    and ksp.ordered_at is null
    and ks.status in ('full', 'ordered')
    and (_shop_area is null or ks.shop_area = _shop_area);

  return jsonb_build_object('items', _items);
end;
$$;

revoke all on function public.admin_list_customer_kit_checkout_options(uuid, text) from public, anon;
grant execute on function public.admin_list_customer_kit_checkout_options(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Internal: catalog cart line for staged admin checkout
-- ---------------------------------------------------------------------------

create or replace function public.admin_insert_catalog_cart_line(
  _cart_id uuid,
  _user_id uuid,
  _shop_area text,
  _vendor_code text,
  _product_id uuid,
  _quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _product public.products;
  _code text;
  _markup numeric;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _p_for_bulk public.products;
  _area_factor numeric := 1.0;
  _rate numeric;
  _line numeric;
  _position integer;
  _item_id uuid;
  _discounts boolean;
begin
  if _quantity is null or _quantity <= 0 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  _code := upper(btrim(coalesce(_vendor_code, '')));
  if _code = '' then
    raise exception 'Produktcode fehlt.' using errcode = '22023';
  end if;

  _product := public.resolve_area_catalog_product(_shop_area, _code, _product_id);
  if _product.id is null or not _product.is_active then
    raise exception 'Produkt ist nicht verfügbar.' using errcode = 'P0002';
  end if;

  if not public.user_can_access_shop_area(_user_id, _shop_area) then
    raise exception 'Kunde hat keinen Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = _shop_area;
  _area_factor := coalesce(_area_factor, 1.0);

  _markup := public.markup_percent_for(_user_id);
  _discounts := public.quantity_discounts_enabled();
  _sell := public.shop_area_sell_unit_price(_product, _quantity, _markup, _shop_area);
  _normal := public.shop_area_sell_unit_price(_product, 1, _markup, _shop_area);

  if public.shop_area_pricing_profile(_shop_area) = 'retail'
     and public.product_uses_kit_unit_pricing(_product) then
    _bulk := null;
    _tier := 'normal';
  elsif _discounts
        and _product.bulk_price_usd is not null
        and _product.bulk_price_min_quantity is not null
        and _product.bulk_price_min_quantity > 0 then
    _p_for_bulk := public.apply_shop_area_product_overrides(_product, _shop_area);
    _bulk := public.apply_role_markup(
      public.catalog_bulk_unit_price(
        _p_for_bulk.price_usd,
        _p_for_bulk.bulk_price_usd,
        _p_for_bulk.bulk_price_min_quantity
      ) * _area_factor,
      _markup
    );
    _tier := case
      when _quantity >= _product.bulk_price_min_quantity then 'bulk'
      else 'normal'
    end;
  else
    _bulk := null;
    _tier := 'normal';
  end if;

  select rate into _rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'EUR'
  order by fetched_at desc nulls last
  limit 1;

  _line := round((_quantity * _sell)::numeric, 2);

  select coalesce(max(position), -1) + 1 into _position
  from public.cart_items
  where cart_id = _cart_id;

  insert into public.cart_items (
    cart_id, position, product_id, vendor_code, product_code_input, product_code_snapshot,
    product_name_snapshot, quantity, unit_price_usd_snapshot, normal_price_usd_snapshot,
    bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot, applied_price_tier,
    exchange_rate_snapshot, eur_value_snapshot, price_snapshot_at, resolution_status, shop_area
  )
  values (
    _cart_id, _position,
    case when exists (select 1 from public.products p where p.id = _product.id) then _product.id else null end,
    _product.code, _product.code, _product.code, _product.name,
    _quantity, _sell, _normal, _bulk,
    case when _discounts then _product.bulk_price_min_quantity else null end,
    _tier, _rate,
    case when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2) else null end,
    now(), 'resolved', _shop_area
  )
  returning id into _item_id;

  return _item_id;
end;
$$;

revoke all on function public.admin_insert_catalog_cart_line(uuid, uuid, text, text, uuid, numeric)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Preview + create (cart staging isolated; One Cart restored after)
-- ---------------------------------------------------------------------------

create or replace function public.admin_preview_order_for_customer(
  _customer_user_id uuid,
  _lines jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _row jsonb;
  _kind text;
  _shop_area text;
  _code text;
  _product_id uuid;
  _qty numeric;
  _kit_id uuid;
  _product public.products;
  _markup numeric;
  _sell numeric;
  _catalog_unit numeric;
  _line_total numeric;
  _items jsonb := '[]'::jsonb;
  _total_usd numeric(14, 2) := 0;
  _kit public.kit_shares;
  _part public.kit_share_participants;
  _allocated integer;
begin
  perform public.assert_admin_authenticated();
  if _customer_user_id is null then
    raise exception 'Benutzer fehlt.' using errcode = '22023';
  end if;
  if _lines is null or jsonb_typeof(_lines) <> 'array' or jsonb_array_length(_lines) < 1 then
    raise exception 'Mindestens eine Position erforderlich.' using errcode = '22023';
  end if;

  _markup := public.markup_percent_for(_customer_user_id);

  for _row in select * from jsonb_array_elements(_lines)
  loop
    _kind := coalesce(_row->>'kind', _row->>'type', '');
    if _kind = 'kit' then
      _kit_id := nullif(_row->>'kitShareId', '')::uuid;
      if _kit_id is null then
        raise exception 'Kit fehlt.' using errcode = '22023';
      end if;
      select * into _kit from public.kit_shares where id = _kit_id;
      if not found then
        raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
      end if;
      select * into _part
      from public.kit_share_participants
      where kit_share_id = _kit_id and user_id = _customer_user_id;
      if not found then
        raise exception 'Kunde ist kein Teilnehmer dieses Kits.' using errcode = 'P0001';
      end if;
      if _part.ordered_at is not null then
        raise exception 'Kit-Anteil wurde bereits bestellt.' using errcode = 'P0001';
      end if;
      if not public.cart_kit_share_is_checkout_ready(_kit_id, _customer_user_id, _part.quantity) then
        raise exception 'Kit-Anteil ist noch nicht bestellbereit.' using errcode = 'P0001';
      end if;
      _product := public.kit_share_catalog_product(_kit);
      _qty := _part.quantity;
      _sell := public.shop_area_sell_unit_price(_product, _qty, _markup, _kit.shop_area);
      select coalesce(sum(quantity), 0)::integer into _allocated
      from public.kit_share_participants where kit_share_id = _kit_id;
      _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);
      _line_total := round((_qty * _sell)::numeric, 2);
      _items := _items || jsonb_build_array(jsonb_build_object(
        'kind', 'kit',
        'kitShareId', _kit_id,
        'shopArea', _kit.shop_area,
        'productCode', _product.code,
        'productName', _product.name,
        'quantity', _qty,
        'unitPriceUsd', _sell,
        'catalogUnitUsd', _catalog_unit,
        'lineTotalUsd', _line_total
      ));
    elsif _kind = 'catalog' then
      _shop_area := nullif(btrim(_row->>'shopArea'), '');
      _code := upper(btrim(coalesce(_row->>'vendorCode', _row->>'code', '')));
      _product_id := nullif(_row->>'productId', '')::uuid;
      _qty := (_row->>'quantity')::numeric;
      if _shop_area is null or _code = '' or _qty is null or _qty <= 0 then
        raise exception 'Ungültige Katalogposition.' using errcode = '22023';
      end if;
      _product := public.resolve_area_catalog_product(_shop_area, _code, _product_id);
      if _product.id is null or not _product.is_active then
        raise exception 'Produkt % ist nicht verfügbar.', _code using errcode = 'P0002';
      end if;
      _sell := public.shop_area_sell_unit_price(_product, _qty, _markup, _shop_area);
      _catalog_unit := public.shop_area_catalog_unit(_product, _qty, _shop_area);
      _line_total := round((_qty * _sell)::numeric, 2);
      _items := _items || jsonb_build_array(jsonb_build_object(
        'kind', 'catalog',
        'shopArea', _shop_area,
        'productCode', _product.code,
        'productName', _product.name,
        'quantity', _qty,
        'unitPriceUsd', _sell,
        'catalogUnitUsd', _catalog_unit,
        'lineTotalUsd', _line_total
      ));
    else
      raise exception 'Unbekannte Positionsart.' using errcode = '22023';
    end if;
    _total_usd := _total_usd + _line_total;
  end loop;

  return jsonb_build_object(
    'customerUserId', _customer_user_id,
    'markupPercent', _markup,
    'roleName', public.customer_role_name_for(_customer_user_id),
    'items', _items,
    'totalUsd', _total_usd
  );
end;
$$;

revoke all on function public.admin_preview_order_for_customer(uuid, jsonb) from public, anon;
grant execute on function public.admin_preview_order_for_customer(uuid, jsonb) to authenticated;

create or replace function public.admin_create_order_for_customer(
  _customer_user_id uuid,
  _lines jsonb,
  _note text,
  _payment_method text,
  _shipping_first_name text,
  _shipping_last_name text,
  _shipping_street text,
  _shipping_house_number text,
  _shipping_address_extra text,
  _shipping_postal_code text,
  _shipping_city text,
  _shipping_country text,
  _shipping_delivery_method text,
  _shipping_packstation_number text,
  _shipping_post_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _cart public.carts;
  _backup jsonb := '[]'::jsonb;
  _row jsonb;
  _kind text;
  _shop_area text;
  _code text;
  _product_id uuid;
  _qty numeric;
  _kit_id uuid;
  _staged_ids uuid[] := '{}'::uuid[];
  _new_id uuid;
  _result jsonb;
  _rec jsonb;
begin
  _admin := public.assert_admin_authenticated();
  if _customer_user_id is null then
    raise exception 'Benutzer fehlt.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = _customer_user_id) then
    raise exception 'Benutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if _lines is null or jsonb_typeof(_lines) <> 'array' or jsonb_array_length(_lines) < 1 then
    raise exception 'Mindestens eine Position erforderlich.' using errcode = '22023';
  end if;

  perform public.admin_preview_order_for_customer(_customer_user_id, _lines);

  _cart := public.get_or_create_user_cart_for(_customer_user_id);

  select coalesce(jsonb_agg(to_jsonb(ci) order by ci.position), '[]'::jsonb)
  into _backup
  from public.cart_items ci
  where ci.cart_id = _cart.id
    and ci.submitted_order_id is null;

  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('kit.skip_cart_removal_tracking', 'on', true);

  delete from public.cart_items ci
  where ci.cart_id = _cart.id
    and ci.submitted_order_id is null;

  for _row in select * from jsonb_array_elements(_lines)
  loop
    _kind := coalesce(_row->>'kind', _row->>'type', '');
    if _kind = 'kit' then
      _kit_id := nullif(_row->>'kitShareId', '')::uuid;
      _new_id := public.kit_share_sync_participant_cart(_kit_id, _customer_user_id);
      if _new_id is not null then
        _staged_ids := array_append(_staged_ids, _new_id);
      end if;
    elsif _kind = 'catalog' then
      _shop_area := nullif(btrim(_row->>'shopArea'), '');
      _code := upper(btrim(coalesce(_row->>'vendorCode', _row->>'code', '')));
      _product_id := nullif(_row->>'productId', '')::uuid;
      _qty := (_row->>'quantity')::numeric;
      _new_id := public.admin_insert_catalog_cart_line(
        _cart.id, _customer_user_id, _shop_area, _code, _product_id, _qty
      );
      _staged_ids := array_append(_staged_ids, _new_id);
    else
      raise exception 'Unbekannte Positionsart.' using errcode = '22023';
    end if;
  end loop;

  perform public.refresh_cart_selling_prices_for_user(_cart.id, _customer_user_id);

  perform set_config('peptix.checkout_subject_user_id', _customer_user_id::text, true);
  perform set_config('peptix.admin_checkout', 'on', true);

  begin
    _result := public.create_order(
      _cart.id,
      _note,
      _payment_method,
      _shipping_first_name,
      _shipping_last_name,
      _shipping_street,
      _shipping_house_number,
      _shipping_address_extra,
      _shipping_postal_code,
      _shipping_city,
      _shipping_country,
      _shipping_delivery_method,
      _shipping_packstation_number,
      _shipping_post_number
    );
  exception
    when others then
      delete from public.cart_items ci
      where ci.cart_id = _cart.id
        and ci.submitted_order_id is null;

      for _rec in select * from jsonb_array_elements(_backup)
      loop
        insert into public.cart_items
        select * from jsonb_populate_record(null::public.cart_items, _rec);
      end loop;

      perform set_config('peptix.checkout_subject_user_id', '', true);
      perform set_config('peptix.admin_checkout', '', true);
      perform set_config('kit.skip_customer_lock', '', true);
      perform set_config('kit.skip_cart_removal_tracking', '', true);
      raise;
  end;

  perform set_config('peptix.checkout_subject_user_id', '', true);
  perform set_config('peptix.admin_checkout', '', true);

  delete from public.cart_items ci
  where ci.cart_id = _cart.id
    and ci.submitted_order_id is null;

  for _rec in select * from jsonb_array_elements(_backup)
  loop
    insert into public.cart_items
    select * from jsonb_populate_record(null::public.cart_items, _rec);
  end loop;

  if exists (
    select 1 from public.cart_items ci
    where ci.cart_id = _cart.id and ci.submitted_order_id is null and ci.quantity > 0
  ) then
    update public.carts
    set status = 'draft', is_active_cart = true, updated_at = now()
    where id = _cart.id;
  end if;

  perform set_config('kit.skip_customer_lock', '', true);
  perform set_config('kit.skip_cart_removal_tracking', '', true);

  return _result || jsonb_build_object('customerUserId', _customer_user_id, 'adminUserId', _admin);
end;
$$;

revoke all on function public.admin_create_order_for_customer(
  uuid, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_create_order_for_customer(
  uuid, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

comment on function public.admin_create_order_for_customer(
  uuid, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) is
  'Admin-only: stage lines on customer One Cart, run create_order with subject GUC, restore open cart lines.';

-- 0099_admin_create_order_for_user.sql
-- Admin checkout on behalf of a customer using existing create_order / create_one_area_order.
-- Subject user GUC drives pricing, kit participant checks, and orders.user_id.

-- ---------------------------------------------------------------------------
-- Checkout subject (customer) vs actor (signed-in user, often admin)
-- ---------------------------------------------------------------------------

create or replace function public.peptix_checkout_subject_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _raw text;
begin
  _raw := nullif(trim(current_setting('peptix.checkout_subject_user_id', true)), '');
  if _raw is not null then
    begin
      return _raw::uuid;
    exception
      when others then
        null;
    end;
  end if;
  return auth.uid();
end;
$$;

revoke all on function public.peptix_checkout_subject_user_id() from public, anon, authenticated;

create or replace function public.assert_admin_authenticated()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  return _uid;
end;
$$;

revoke all on function public.assert_admin_authenticated() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Patched checkout (subject-aware)
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

  if not public.user_can_access_shop_area(public.peptix_checkout_subject_user_id(), _area) then
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
        and public.cart_kit_share_is_checkout_ready(ci.kit_share_id, public.peptix_checkout_subject_user_id(), ci.quantity)
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

  _markup    := public.markup_percent_for(public.peptix_checkout_subject_user_id());
  _role_name := public.customer_role_name_for(public.peptix_checkout_subject_user_id());

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
    public.peptix_checkout_subject_user_id(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), _payment_method,
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
      if not public.cart_kit_share_is_checkout_ready(_item.kit_share_id, public.peptix_checkout_subject_user_id(), _item.quantity) then
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
      where kit_share_id = _item.kit_share_id and user_id = public.peptix_checkout_subject_user_id()
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

  if coalesce(current_setting('peptix.admin_checkout', true), '') = 'on' then
    perform public.log_audit(
      auth.uid(), 'order.admin_create', 'order', _order_id,
      jsonb_build_object('userId', public.peptix_checkout_subject_user_id()),
      jsonb_build_object(
        'orderNumber', _order_number,
        'totalUsd', _total_usd,
        'itemCount', _position,
        'paymentMethod', _payment_method,
        'deliveryMethod', _shipping_delivery_method,
        'shopArea', _area,
        'targetUserId', public.peptix_checkout_subject_user_id()
      )
    );
  else
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
  end if;

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd, 'shopArea', _area);
end;
$$;

create or replace function public.create_order(
  _cart_id                     uuid,
  _note                        text default null,
  _payment_method              text default null,
  _shipping_first_name         text default null,
  _shipping_last_name          text default null,
  _shipping_street             text default null,
  _shipping_house_number       text default null,
  _shipping_address_extra      text default null,
  _shipping_postal_code        text default null,
  _shipping_city               text default null,
  _shipping_country            text default null,
  _shipping_delivery_method    text default null,
  _shipping_packstation_number text default null,
  _shipping_post_number        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart        record;
  _telegram    text;
  _first       text;
  _last        text;
  _street      text;
  _house       text;
  _extra       text;
  _postal      text;
  _city        text;
  _country     text;
  _delivery    text;
  _packstation text;
  _post_number text;
  _area        text;
  _areas       text[];
  _result      jsonb;
  _results     jsonb := '[]'::jsonb;
  _remaining   int;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_public_site_access();

  if _payment_method is null or _payment_method not in ('crypto', 'bank_transfer', 'paypal') then
    raise exception 'Bitte wählen Sie eine Zahlungsmethode aus.' using errcode = 'P0001';
  end if;

  select nullif(trim(username), '') into _telegram from public.profiles where id = public.peptix_checkout_subject_user_id();
  if _telegram is null then
    raise exception 'Bitte zuerst einen Telegram Benutzernamen festlegen.' using errcode = 'P0001';
  end if;

  if _shipping_delivery_method is null or _shipping_delivery_method not in ('home', 'packstation') then
    raise exception 'Bitte wählen Sie eine Lieferart aus.' using errcode = 'P0001';
  end if;
  _delivery := _shipping_delivery_method;

  _first  := public.require_shipping_text(_shipping_first_name,   'Bitte Vorname angeben.',    80);
  _last   := public.require_shipping_text(_shipping_last_name,    'Bitte Nachname angeben.',   80);
  _postal := public.require_shipping_text(_shipping_postal_code,  'Bitte PLZ angeben.',        16);
  _city   := public.require_shipping_text(_shipping_city,         'Bitte Ort angeben.',        80);
  _country := public.require_shipping_text(_shipping_country,     'Bitte Land angeben.',       56);

  if _delivery = 'home' then
    _street := public.require_shipping_text(_shipping_street,       'Bitte Straße angeben.',      120);
    _house  := public.require_shipping_text(_shipping_house_number, 'Bitte Hausnummer angeben.',   20);
    _extra  := nullif(trim(coalesce(_shipping_address_extra, '')), '');
    if _extra is not null and (char_length(_extra) > 120 or _extra ~ '[[:cntrl:]]') then
      raise exception 'Adresszusatz ist ungültig.' using errcode = 'P0001';
    end if;
    _packstation := null;
    _post_number := null;
  else
    _packstation := public.require_shipping_text(_shipping_packstation_number, 'Bitte Packstation Nummer angeben.', 20);
    _post_number := public.require_shipping_text(_shipping_post_number,        'Bitte Postnummer angeben.',         20);
    _street := null;
    _house  := null;
    _extra  := null;
  end if;

  select * into _cart
  from public.carts
  where id = _cart_id and user_id = public.peptix_checkout_subject_user_id() and deleted_at is null
  for update;

  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _cart.status not in ('draft', 'ready') then
    raise exception 'Dieser Warenkorb wurde bereits bestellt oder ist archiviert.' using errcode = 'P0001';
  end if;

  select array_agg(
           distinct public.cart_item_shop_area(ci.shop_area, _cart.shop_area)
           order by public.cart_item_shop_area(ci.shop_area, _cart.shop_area)
         )
  into _areas
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.quantity > 0
    and ci.submitted_order_id is null
    and (
      (
        ci.kit_share_id is not null
        and public.cart_kit_share_is_checkout_ready(ci.kit_share_id, public.peptix_checkout_subject_user_id(), ci.quantity)
      )
      or (
        ci.kit_share_id is null
        and exists (
          select 1
          from public.shop_area_products sap
          where sap.shop_area_key = public.cart_item_shop_area(ci.shop_area, _cart.shop_area)
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

  if _areas is null or array_length(_areas, 1) is null then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  foreach _area in array _areas
  loop
    _result := public.create_one_area_order(
      _cart_id, _area, _note, _payment_method,
      _first, _last, _street, _house, _extra, _postal, _city, _country,
      _delivery, _packstation, _post_number, _telegram
    );
    _results := _results || jsonb_build_array(_result);
  end loop;

  select count(*) into _remaining
  from public.cart_items
  where cart_id = _cart_id
    and quantity > 0
    and submitted_order_id is null;

  if _remaining = 0 then
    update public.carts
    set status = 'ordered', is_active_cart = false
    where id = _cart_id;
  end if;

  return (_results -> 0) || jsonb_build_object('orders', _results);
end;
$$;

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
  uuid, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_create_order_for_customer(
  uuid, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

comment on function public.admin_create_order_for_customer(
  uuid, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text
) is
  'Admin-only: stage lines on customer One Cart, run create_order with subject GUC, restore open cart lines.';

revoke all on function public.create_one_area_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text)
  to authenticated;

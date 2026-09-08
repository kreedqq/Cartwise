-- 0055_checkout_bulk_price_factor.sql
-- Fixes the bulk-price snapshot in create_order and sync_cart_selling_prices so that
-- shop_areas.base_price_factor_pct is applied consistently to ALL price snapshots,
-- not only to the billing unit price.
--
-- ROOT CAUSE
--   After migration 0054, the billing price (_sell / unit_price_usd_snapshot) is correct
--   and matches the catalog: it chains through shop_area_sell_unit_price →
--   shop_area_catalog_unit → base_price_factor_pct.
--
--   However, the _bulk snapshot (bulk_price_usd_snapshot) was still computed via:
--     create_order:             apply_role_markup(raw_product.bulk_price_usd, _markup)
--     sync_cart_selling_prices: apply_role_markup(catalog_bulk_unit_price(...),  _markup)
--   — neither applied the area factor, causing the bulk snapshot to differ from the
--   catalog value shown via list_shop_products_for_area when base_price_factor_pct ≠ 100.
--
-- FIX
--   Both functions now compute _bulk as:
--     catalog_bulk_unit_price(area-overridden prices) × (base_price_factor_pct / 100)
--     then apply_role_markup exactly once.
--   This matches the formula already used in list_shop_products_for_area (0054).
--
-- INVARIANTS
--   • Historical orders and order_items are NOT modified (no UPDATE on existing rows).
--   • Cart security objects from 0051 are unchanged.
--   • Kit pricing (kit_share_sync_participant_cart) is unchanged.
--   • apply_role_markup is called exactly once per price field.
--   • create_order derives _sell via shop_area_sell_unit_price — unchanged, already correct.
--   • No new tables, columns, or policies.

-- ---------------------------------------------------------------------------
-- sync_cart_selling_prices: apply area factor to _bulk snapshot
-- ---------------------------------------------------------------------------

create or replace function public.sync_cart_selling_prices(_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid          uuid := auth.uid();
  _area         text;
  _area_factor  numeric := 1.0;          -- NEW: area base price factor (pct / 100)
  _markup       numeric;
  _item         record;
  _product      public.products;
  _p_for_bulk   public.products;         -- NEW: area-overridden product for bulk snapshot
  _sell         numeric;
  _normal       numeric;
  _bulk         numeric;
  _tier         text;
  _rate         numeric;
  _line         numeric;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.carts
    where id = _cart_id and user_id = _uid and deleted_at is null and status <> 'ordered'
  ) then
    return;
  end if;

  select shop_area into _area from public.carts where id = _cart_id;

  if not public.user_can_access_shop_area(_uid, coalesce(_area, 'shop')) then
    return;
  end if;

  _markup := public.markup_percent_for(_uid);

  -- Load area factor once; used for bulk snapshot inside the item loop.
  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = coalesce(_area, 'shop');
  _area_factor := coalesce(_area_factor, 1.0);

  for _item in
    select * from public.cart_items where cart_id = _cart_id
  loop
    if _item.kit_share_id is not null then
      continue;
    end if;

    select * into _product from public.products where id = _item.product_id;
    if _product.id is null or not _product.is_active then
      continue;
    end if;

    _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, coalesce(_area, 'shop'));
    _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, coalesce(_area, 'shop'));

    if public.shop_area_pricing_profile(coalesce(_area, 'shop')) = 'retail'
       and public.product_uses_kit_unit_pricing(_product) then
      _bulk := null;
      _tier := 'normal';
    else
      if _product.bulk_price_usd is not null
         and _product.bulk_price_min_quantity is not null
         and _product.bulk_price_min_quantity > 0 then
        -- FIX: apply area factor to bulk snapshot to match list_shop_products_for_area.
        _p_for_bulk := public.apply_shop_area_product_overrides(_product, coalesce(_area, 'shop'));
        _bulk := public.apply_role_markup(
          public.catalog_bulk_unit_price(
            _p_for_bulk.price_usd,
            _p_for_bulk.bulk_price_usd,
            _p_for_bulk.bulk_price_min_quantity
          ) * _area_factor,
          _markup
        );
      else
        _bulk := null;
      end if;

      _tier := case
        when _bulk is not null and _item.quantity >= _product.bulk_price_min_quantity then 'bulk'
        else 'normal'
      end;
    end if;

    _rate := _item.exchange_rate_snapshot;
    _line := round((_item.quantity * _sell)::numeric, 2);

    update public.cart_items
    set
      unit_price_usd_snapshot          = _sell,
      normal_price_usd_snapshot        = _normal,
      bulk_price_usd_snapshot          = _bulk,
      bulk_price_min_quantity_snapshot = _product.bulk_price_min_quantity,
      applied_price_tier               = _tier,
      eur_value_snapshot               = case
                                           when _rate is not null and _rate > 0
                                             then round((_line * _rate)::numeric, 2)
                                           else eur_value_snapshot
                                         end,
      price_snapshot_at                = now(),
      resolution_status                = 'resolved',
      product_code_snapshot            = _product.code,
      product_name_snapshot            = _product.name
    where id = _item.id;
  end loop;
end;
$$;

revoke all on function public.sync_cart_selling_prices(uuid) from public;
grant execute on function public.sync_cart_selling_prices(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_order: apply area factor to _bulk snapshot
-- (Billing price _sell was already correct via shop_area_sell_unit_price → 0054.)
-- ---------------------------------------------------------------------------

create or replace function public.create_order(
  _cart_id                    uuid,
  _note                       text    default null,
  _payment_method             text    default null,
  _shipping_first_name        text    default null,
  _shipping_last_name         text    default null,
  _shipping_street            text    default null,
  _shipping_house_number      text    default null,
  _shipping_address_extra     text    default null,
  _shipping_postal_code       text    default null,
  _shipping_city              text    default null,
  _shipping_country           text    default null,
  _shipping_delivery_method   text    default null,
  _shipping_packstation_number text   default null,
  _shipping_post_number       text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart                 record;
  _area                 text;
  _area_factor          numeric := 1.0;   -- NEW: base_price_factor_pct / 100
  _item                 record;
  _product              public.products;
  _product_row          public.products;
  _p_for_bulk           public.products;  -- NEW: area-overridden product for bulk snapshot
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
  _telegram             text;
  _first                text;
  _last                 text;
  _street               text;
  _house                text;
  _extra                text;
  _postal               text;
  _city                 text;
  _country              text;
  _delivery             text;
  _packstation          text;
  _post_number          text;
  _role_name            text;
  _catalog_unit         numeric;
  _base_line            numeric(12, 2);
  _allocated            integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _payment_method is null or _payment_method not in ('crypto', 'bank_transfer', 'paypal') then
    raise exception 'Bitte wählen Sie eine Zahlungsmethode aus.' using errcode = 'P0001';
  end if;

  select nullif(trim(username), '') into _telegram from public.profiles where id = auth.uid();
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
  where id = _cart_id and user_id = auth.uid() and deleted_at is null
  for update;

  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _area := coalesce(_cart.shop_area, 'shop');

  if not public.user_can_access_shop_area(auth.uid(), _area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  -- Load area factor once; used for bulk snapshot inside the item loop.
  -- _sell is derived via shop_area_sell_unit_price which already chains through
  -- shop_area_catalog_unit → base_price_factor_pct (correct since 0054).
  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = _area;
  _area_factor := coalesce(_area_factor, 1.0);

  if _cart.status not in ('draft', 'ready') then
    raise exception 'Dieser Warenkorb wurde bereits bestellt oder ist archiviert.' using errcode = 'P0001';
  end if;

  select count(*) into _line_count
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = _cart_id
    and p.is_active
    and ci.quantity > 0;

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
    _delivery,
    _first, _last, _street, _house,
    _extra, _packstation, _post_number,
    _postal, _city, _country,
    0, null, null, now(),
    _area
  )
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*
    from public.cart_items ci
    where ci.cart_id = _cart_id and ci.quantity > 0
    order by ci.position
  loop
    select * into _product from public.products where id = _item.product_id and is_active;
    if not found then
      continue;
    end if;

    if _item.kit_share_id is not null then
      if public.shop_area_pricing_profile(_area) = 'retail' then
        raise exception 'Kits sind in diesem Shop-Bereich nicht verfügbar.' using errcode = 'P0001';
      end if;

      select * into _kit from public.kit_shares where id = _item.kit_share_id for update;

      if not found or _kit.status not in ('full', 'ordered') then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      select * into _kit_participant
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id and user_id = auth.uid()
      for update;

      if not found or _kit_participant.quantity <> _item.quantity then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      if _kit_participant.ordered_at is not null then
        raise exception 'Dieser Kit-Anteil wurde bereits bestellt.' using errcode = 'P0001';
      end if;

      _sell  := _item.unit_price_usd_snapshot;
      _normal := _sell;
      _bulk  := null;
      _tier  := 'normal';

      update public.kit_share_participants
      set ordered_at = now(), order_id = _order_id, updated_at = now()
      where id = _kit_participant.id;

      if not (_item.kit_share_id = any(coalesce(_kit_share_ids, array[]::uuid[]))) then
        _kit_share_ids := coalesce(_kit_share_ids, array[]::uuid[]) || _item.kit_share_id;
      end if;
    else
      -- _sell and _normal already use shop_area_sell_unit_price → base_price_factor_pct (0054).
      _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _area);
      _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, _area);

      if public.shop_area_pricing_profile(_area) = 'retail'
         and public.product_uses_kit_unit_pricing(_product) then
        _bulk := null;
        _tier := 'normal';
      elsif _product.bulk_price_usd is not null
            and _product.bulk_price_min_quantity is not null
            and _product.bulk_price_min_quantity > 0 then
        -- FIX: apply area factor to bulk snapshot so it matches list_shop_products_for_area.
        -- Previously: apply_role_markup(raw_bulk, _markup) — missing area factor.
        _p_for_bulk := public.apply_shop_area_product_overrides(_product, _area);
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

    insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _product.id,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, _product.bulk_price_min_quantity,
      _tier, _sell, _item.quantity, _line_total,
      _rate, _eur
    )
    returning id into _order_item_id;

    if _item.kit_share_id is not null then
      select coalesce(sum(quantity), 0)::integer into _allocated
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id;
      select * into _product_row from public.products where id = _product.id;
      _catalog_unit := public.kit_share_catalog_unit_usd(_product_row, _kit.kit_size_vials, _allocated);
    else
      _catalog_unit := public.shop_area_catalog_unit(_product, _item.quantity, _area);
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

    _position := _position + 1;
  end loop;

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

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber',   _order_number,
      'totalUsd',      _total_usd,
      'itemCount',     _line_count,
      'paymentMethod', _payment_method,
      'deliveryMethod', _delivery,
      'shopArea',      _area
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- 0061_app_settings.sql
-- Global app settings (quantity discounts + maintenance) and pricing/access wiring.
-- Additive only. Does not rewrite products, orders, carts, or historical snapshots.

-- ---------------------------------------------------------------------------
-- app_settings: one row per global boolean flag
-- ---------------------------------------------------------------------------

create table if not exists public.app_settings (
  key        text primary key,
  value_bool boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.app_settings is
  'Global boolean flags. Keys: maintenance_mode, quantity_discounts_enabled.';

insert into public.app_settings (key, value_bool)
values
  ('maintenance_mode', false),
  ('quantity_discounts_enabled', true)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_authenticated on public.app_settings;
create policy app_settings_select_authenticated
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update
  on public.app_settings for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Readers (fail-closed maintenance, fail-closed bulk = no customer-forced discount)
-- ---------------------------------------------------------------------------

create or replace function public.maintenance_mode_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.value_bool from public.app_settings s where s.key = 'maintenance_mode'),
    true
  );
$$;

revoke all on function public.maintenance_mode_enabled() from public, anon, authenticated;

create or replace function public.quantity_discounts_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.value_bool from public.app_settings s where s.key = 'quantity_discounts_enabled'),
    false
  );
$$;

revoke all on function public.quantity_discounts_enabled() from public, anon, authenticated;

create or replace function public.caller_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.has_role(auth.uid(), 'admin');
$$;

revoke all on function public.caller_is_admin() from public, anon, authenticated;

create or replace function public.site_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.maintenance_mode_enabled()) or public.caller_is_admin();
$$;

revoke all on function public.site_access_allowed() from public, anon, authenticated;

create or replace function public.assert_public_site_access()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.site_access_allowed() then
    raise exception 'Die Website ist vorübergehend nicht erreichbar.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_public_site_access() from public, anon, authenticated;

-- Public site-state RPC: anon needs this for fail-closed login/register UX.
create or replace function public.get_site_access_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _maintenance boolean;
  _discounts   boolean;
  _admin       boolean;
begin
  _maintenance := public.maintenance_mode_enabled();
  _discounts   := public.quantity_discounts_enabled();
  _admin       := public.caller_is_admin();

  return jsonb_build_object(
    'maintenance_mode', _maintenance,
    'quantity_discounts_enabled', _discounts,
    'caller_is_admin', _admin,
    'site_access_allowed', (not _maintenance) or _admin
  );
end;
$$;

revoke all on function public.get_site_access_state() from public;
grant execute on function public.get_site_access_state() to anon, authenticated;

create or replace function public.admin_set_app_setting(_key text, _value boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if _key is null or _key not in ('maintenance_mode', 'quantity_discounts_enabled') then
    raise exception 'Unbekannte Einstellung.' using errcode = 'P0001';
  end if;

  update public.app_settings
  set value_bool = _value,
      updated_at = now(),
      updated_by = auth.uid()
  where key = _key;

  if not found then
    raise exception 'Einstellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform public.log_audit(
    auth.uid(),
    'app_settings.update',
    'app_settings',
    null,
    null,
    jsonb_build_object('key', _key, 'value', _value)
  );

  return public.get_site_access_state();
end;
$$;

revoke all on function public.admin_set_app_setting(text, boolean) from public, anon;
grant execute on function public.admin_set_app_setting(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Shop-area access: non-admins lose area access while maintenance is on.
-- Admins keep the existing role-based shop-area checks (no new admin identity).
-- ---------------------------------------------------------------------------

create or replace function public.user_can_access_shop_area(_user_id uuid, _area_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      not public.maintenance_mode_enabled()
      or public.has_role(_user_id, 'admin')
    )
    and (
      exists (
        select 1
        from public.shop_areas a
        join public.shop_area_role_access x on x.shop_area_key = a.key
        join public.user_customer_roles u on u.role_id = x.role_id
        where a.key = _area_key
          and a.is_active
          and u.user_id = _user_id
      )
      or exists (
        select 1
        from public.shop_areas a
        join public.shop_area_role_access x on x.shop_area_key = a.key
        join public.customer_roles r on r.id = x.role_id
        where a.key = _area_key
          and a.is_active
          and r.is_default
          and not exists (select 1 from public.user_customer_roles u where u.user_id = _user_id)
      )
    );
$$;

revoke all on function public.user_can_access_shop_area(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Quantity-tier SSoT: sell_unit_price ignores bulk when the global switch is off.
-- ---------------------------------------------------------------------------

create or replace function public.sell_unit_price(
  _price numeric,
  _bulk numeric,
  _bulk_min numeric,
  _qty numeric,
  _percent numeric
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.apply_role_markup(
    case
      when public.quantity_discounts_enabled()
        and _bulk is not null
        and _bulk_min is not null
        and _bulk_min > 0
        and _qty is not null
        and _qty >= _bulk_min
        then public.catalog_bulk_unit_price(_price, _bulk, _bulk_min)
      else _price
    end,
    _percent
  );
$$;

revoke all on function public.sell_unit_price(numeric, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;

create or replace function public.selling_prices_for(
  _user_id uuid,
  _price numeric,
  _bulk numeric,
  _bulk_min numeric
)
returns table (price_usd numeric, bulk_price_usd numeric, bulk_price_min_quantity numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _pct numeric;
  _bulk_unit numeric;
begin
  _pct := public.markup_percent_for(_user_id);
  price_usd := public.apply_role_markup(_price, _pct);
  if public.quantity_discounts_enabled()
     and _bulk is not null
     and _bulk_min is not null
     and _bulk_min > 0 then
    _bulk_unit := public.catalog_bulk_unit_price(_price, _bulk, _bulk_min);
    bulk_price_usd := public.apply_role_markup(_bulk_unit, _pct);
    bulk_price_min_quantity := _bulk_min;
  else
    bulk_price_usd := null;
    bulk_price_min_quantity := null;
  end if;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- list_shop_products_for_area: hide bulk fields when discounts are off
-- ---------------------------------------------------------------------------

create or replace function public.list_shop_products_for_area(_shop_area text)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid          uuid := auth.uid();
  _area         public.shop_areas;
  _p            public.products;
  _src          public.products;
  _pct          numeric;
  _factor       numeric;
  _divisor      numeric;
  _catalog_unit numeric;
  _src_price    numeric;
  _src_bulk     numeric;
  _discounts    boolean;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_public_site_access();

  select * into _area from public.shop_areas where key = _shop_area and is_active;
  if not found then
    raise exception 'Unbekannter oder inaktiver Shop-Bereich.' using errcode = 'P0001';
  end if;

  if not public.user_can_access_shop_area(_uid, _shop_area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  _factor    := _area.base_price_factor_pct / 100.0;
  _divisor   := _area.kit_unit_divisor;
  _discounts := public.quantity_discounts_enabled();

  for _src in
    select * from public.products p
    where p.is_active = true
      and public.product_visible_in_shop_area(p.id, _shop_area)
    order by p.code
  loop
    _p         := public.apply_shop_area_product_overrides(_src, _shop_area);
    _pct       := public.markup_percent_for_area(_uid, _shop_area, _p.id);
    _src_price := _p.price_usd;
    _src_bulk  := _p.bulk_price_usd;

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
      _p.price_usd               := public.apply_role_markup(_catalog_unit, _pct)::numeric(12, 4);
      _p.bulk_price_usd          := null;
      _p.bulk_price_min_quantity := null;
    end if;
    return next _p;
  end loop;
end;
$$;

revoke all on function public.list_shop_products_for_area(text) from public;
grant execute on function public.list_shop_products_for_area(text) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_cart_selling_prices: billed unit follows sell_unit_price; bulk snapshot
-- is omitted when quantity discounts are off.
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
  _area_factor  numeric := 1.0;
  _markup       numeric;
  _item         record;
  _product      public.products;
  _p_for_bulk   public.products;
  _sell         numeric;
  _normal       numeric;
  _bulk         numeric;
  _tier         text;
  _rate         numeric;
  _line         numeric;
  _discounts    boolean;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_public_site_access();

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

  _markup    := public.markup_percent_for(_uid);
  _discounts := public.quantity_discounts_enabled();

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
    elsif _discounts
          and _product.bulk_price_usd is not null
          and _product.bulk_price_min_quantity is not null
          and _product.bulk_price_min_quantity > 0 then
      _p_for_bulk := public.apply_shop_area_product_overrides(_product, coalesce(_area, 'shop'));
      _bulk := public.apply_role_markup(
        public.catalog_bulk_unit_price(
          _p_for_bulk.price_usd,
          _p_for_bulk.bulk_price_usd,
          _p_for_bulk.bulk_price_min_quantity
        ) * _area_factor,
        _markup
      );
      _tier := case
        when _bulk is not null and _item.quantity >= _product.bulk_price_min_quantity then 'bulk'
        else 'normal'
      end;
    else
      _bulk := null;
      _tier := 'normal';
    end if;

    _rate := _item.exchange_rate_snapshot;
    _line := round((_item.quantity * _sell)::numeric, 2);

    update public.cart_items
    set
      unit_price_usd_snapshot          = _sell,
      normal_price_usd_snapshot        = _normal,
      bulk_price_usd_snapshot          = _bulk,
      bulk_price_min_quantity_snapshot = case when _discounts then _product.bulk_price_min_quantity else null end,
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
-- create_order: same 0056 body + maintenance assert + quantity-discount snapshots
-- Historical order_items are not rewritten.
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

  perform public.assert_public_site_access();

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

  -- Load area factor once (from 0055; used for bulk snapshot).
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
      -- Kit item: area access already checked via kit_share_participants_protect_area.
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
      -- Regular (non-kit) item: FAIL CLOSED on vendor catalog membership (0056).
      -- If ANY item is outside the area's allowlist, the entire order is rejected.
      -- Silently skipping would allow a malicious actor to inject a non-catalog
      -- product and still receive a partial order for the valid items.
      if not public.product_visible_in_shop_area(_product.id, _area) then
        raise exception 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog.'
          using errcode = 'P0002';
      end if;

      _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _area);
      _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, _area);

      if public.shop_area_pricing_profile(_area) = 'retail'
         and public.product_uses_kit_unit_pricing(_product) then
        _bulk := null;
        _tier := 'normal';
      elsif public.quantity_discounts_enabled()
            and _product.bulk_price_usd is not null
            and _product.bulk_price_min_quantity is not null
            and _product.bulk_price_min_quantity > 0 then
        -- FIX from 0055: apply area factor to bulk snapshot.
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
      _normal, _bulk, case when public.quantity_discounts_enabled() then _product.bulk_price_min_quantity else null end,
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

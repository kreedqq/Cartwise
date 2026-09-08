-- 0051_shop_areas.sql
-- Additive shop-area domain: one catalog, three areas, two pricing profiles.
-- Does not rewrite products, historical orders, role markup percents, or kit math.
-- Existing carts/orders get shop_area = 'shop' / NULL (legacy). No price backfill.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.shop_areas (
  key text primary key
    check (key in ('shop', 'group_buy_1', 'group_buy_2')),
  name text not null,
  is_active boolean not null default true,
  pricing_profile text not null
    check (pricing_profile in ('retail', 'group_buy')),
  retail_price_factor numeric(8, 4) not null default 5
    check (retail_price_factor > 0),
  kit_unit_divisor numeric(8, 4) not null default 10
    check (kit_unit_divisor > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shop_areas is
  'Central shop-area config. retail = Einzelverkauf (kit/divisor*factor or unit*factor) then existing role markup once. group_buy = existing sell_unit_price.';

create trigger shop_areas_set_updated_at
  before update on public.shop_areas
  for each row execute function public.set_updated_at();

create table public.shop_area_role_access (
  shop_area_key text not null references public.shop_areas (key) on delete cascade,
  role_id uuid not null references public.customer_roles (id) on delete cascade,
  primary key (shop_area_key, role_id)
);

comment on table public.shop_area_role_access is
  'Which existing customer_roles may see a shop area. Not a parallel role system.';

alter table public.shop_areas enable row level security;
alter table public.shop_area_role_access enable row level security;

create policy shop_areas_admin_all
  on public.shop_areas for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy shop_area_role_access_admin_all
  on public.shop_area_role_access for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.shop_areas to authenticated;
grant select, insert, update, delete on public.shop_area_role_access to authenticated;

insert into public.shop_areas (key, name, is_active, pricing_profile, retail_price_factor, kit_unit_divisor, sort_order)
values
  ('shop', 'Shop', true, 'retail', 5, 10, 10),
  ('group_buy_1', 'Group Buy 1', true, 'group_buy', 5, 10, 20),
  ('group_buy_2', 'Group Buy 2', true, 'group_buy', 5, 10, 30);

insert into public.customer_roles (name, markup_percent, is_active, is_default)
select 'Group Buy', 0, true, false
where not exists (
  select 1 from public.customer_roles where upper(trim(name)) = 'GROUP BUY'
);

insert into public.shop_area_role_access (shop_area_key, role_id)
select 'shop', r.id
from public.customer_roles r
on conflict do nothing;

insert into public.shop_area_role_access (shop_area_key, role_id)
select a.key, r.id
from public.shop_areas a
cross join public.customer_roles r
where a.key in ('group_buy_1', 'group_buy_2')
  and upper(trim(r.name)) = 'GROUP BUY'
on conflict do nothing;

alter table public.carts
  add column if not exists shop_area text not null default 'shop';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'carts_shop_area_check'
  ) then
    alter table public.carts
      add constraint carts_shop_area_check
      check (shop_area in ('shop', 'group_buy_1', 'group_buy_2'));
  end if;
end
$$;

comment on column public.carts.shop_area is
  'Cart belongs to exactly one shop area. Set at insert for an allowed area; never updated. Mixed-area lines are rejected.';

alter table public.orders
  add column if not exists shop_area text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_shop_area_check'
  ) then
    alter table public.orders
      add constraint orders_shop_area_check
      check (shop_area is null or shop_area in ('shop', 'group_buy_1', 'group_buy_2'));
  end if;
end
$$;

comment on column public.orders.shop_area is
  'Snapshot of the cart shop area at checkout. NULL = legacy order from before shop areas.';

-- ---------------------------------------------------------------------------
-- Access + pricing helpers (SECURITY DEFINER; markup never selected by customers)
-- ---------------------------------------------------------------------------

create or replace function public.user_can_access_shop_area(_user_id uuid, _area_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
  );
$$;

revoke all on function public.user_can_access_shop_area(uuid, text) from public, anon, authenticated;

-- Current-user wrapper for RLS (cannot probe another user_id).
create or replace function public.current_user_can_access_shop_area(_area_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_access_shop_area(auth.uid(), _area_key);
$$;

revoke all on function public.current_user_can_access_shop_area(text) from public, anon;
grant execute on function public.current_user_can_access_shop_area(text) to authenticated;

drop policy if exists "carts_insert_own" on public.carts;
create policy "carts_insert_own"
  on public.carts for insert
  with check (
    user_id = auth.uid()
    and public.current_user_can_access_shop_area(shop_area)
  );

-- RLS WITH CHECK cannot compare OLD vs NEW. Freeze shop_area on UPDATE; re-check access on INSERT
-- so SECURITY DEFINER cart helpers cannot write an area the session user may not use.
create or replace function public.reject_cart_shop_area_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.shop_area is null
       or not public.user_can_access_shop_area(auth.uid(), NEW.shop_area) then
      raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
    end if;
    return NEW;
  end if;

  if NEW.shop_area is distinct from OLD.shop_area then
    raise exception 'Der Shop-Bereich eines Warenkorbs kann nicht geändert werden.' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

revoke all on function public.reject_cart_shop_area_mutation() from public, anon, authenticated;

drop trigger if exists carts_protect_shop_area on public.carts;
create trigger carts_protect_shop_area
  before insert or update of shop_area on public.carts
  for each row execute function public.reject_cart_shop_area_mutation();

create or replace function public.shop_area_pricing_profile(_area_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pricing_profile from public.shop_areas where key = _area_key;
$$;

revoke all on function public.shop_area_pricing_profile(text) from public, anon, authenticated;

create or replace function public.shop_area_catalog_unit(
  _product public.products,
  _qty numeric,
  _area_key text
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _area public.shop_areas;
  _factor numeric;
  _divisor numeric;
  _unit numeric;
begin
  select * into _area from public.shop_areas where key = _area_key;
  if not found then
    raise exception 'Unbekannter Shop-Bereich.' using errcode = 'P0001';
  end if;

  if _area.pricing_profile = 'group_buy' then
    return public.sell_unit_price(
      _product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity,
      _qty, 0
    );
  end if;

  _factor := _area.retail_price_factor;
  _divisor := _area.kit_unit_divisor;

  if public.product_uses_kit_unit_pricing(_product) then
    return (_product.price_usd / _divisor) * _factor;
  end if;

  _unit := public.sell_unit_price(
    _product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity,
    _qty, 0
  );
  return _unit * _factor;
end;
$$;

revoke all on function public.shop_area_catalog_unit(public.products, numeric, text) from public, anon, authenticated;

create or replace function public.shop_area_sell_unit_price(
  _product public.products,
  _qty numeric,
  _percent numeric,
  _area_key text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.apply_role_markup(
    public.shop_area_catalog_unit(_product, _qty, _area_key),
    _percent
  );
$$;

revoke all on function public.shop_area_sell_unit_price(public.products, numeric, numeric, text) from public, anon, authenticated;

create or replace function public.list_my_shop_areas()
returns table (
  key text,
  name text,
  pricing_profile text,
  sort_order integer,
  path text
)
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

  return query
  select
    a.key,
    a.name,
    a.pricing_profile,
    a.sort_order,
    case a.key
      when 'shop' then '/shop'
      when 'group_buy_1' then '/shop/group-buy-1'
      when 'group_buy_2' then '/shop/group-buy-2'
      else '/shop'
    end
  from public.shop_areas a
  where a.is_active
    and public.user_can_access_shop_area(_uid, a.key)
  order by a.sort_order, a.name;
end;
$$;

revoke all on function public.list_my_shop_areas() from public;
grant execute on function public.list_my_shop_areas() to authenticated;

create or replace function public.list_shop_products_for_area(_shop_area text)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _pct numeric;
  _area public.shop_areas;
  _p public.products;
  _factor numeric;
  _divisor numeric;
  _catalog_unit numeric;
  _bulk_unit numeric;
  _src_price numeric;
  _src_bulk numeric;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _area from public.shop_areas where key = _shop_area and is_active;
  if not found then
    raise exception 'Unbekannter oder inaktiver Shop-Bereich.' using errcode = 'P0001';
  end if;

  if not public.user_can_access_shop_area(_uid, _shop_area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  _pct := coalesce(public.markup_percent_for(_uid), 0);
  _factor := _area.retail_price_factor;
  _divisor := _area.kit_unit_divisor;

  for _p in
    select * from public.products p where p.is_active = true order by p.code
  loop
    _src_price := _p.price_usd;
    _src_bulk := _p.bulk_price_usd;
    if _area.pricing_profile = 'group_buy' then
      _p.price_usd := public.apply_role_markup(_src_price, _pct)::numeric(12, 4);
      if _src_bulk is not null and _p.bulk_price_min_quantity is not null and _p.bulk_price_min_quantity > 0 then
        _p.bulk_price_usd := public.apply_role_markup(
          public.catalog_bulk_unit_price(_src_price, _src_bulk, _p.bulk_price_min_quantity),
          _pct
        )::numeric(12, 4);
      else
        _p.bulk_price_usd := null;
      end if;
    else
      if public.product_uses_kit_unit_pricing(_p) then
        _catalog_unit := (_src_price / _divisor) * _factor;
        _p.price_usd := public.apply_role_markup(_catalog_unit, _pct)::numeric(12, 4);
        _p.bulk_price_usd := null;
        _p.bulk_price_min_quantity := null;
      else
        _catalog_unit := _src_price * _factor;
        _bulk_unit := case
          when _src_bulk is not null and _p.bulk_price_min_quantity is not null and _p.bulk_price_min_quantity > 0
            then public.catalog_bulk_unit_price(_src_price, _src_bulk, _p.bulk_price_min_quantity) * _factor
          else null
        end;
        _p.price_usd := public.apply_role_markup(_catalog_unit, _pct)::numeric(12, 4);
        _p.bulk_price_usd := case
          when _bulk_unit is not null then public.apply_role_markup(_bulk_unit, _pct)::numeric(12, 4)
          else null
        end;
      end if;
    end if;
    return next _p;
  end loop;
end;
$$;

revoke all on function public.list_shop_products_for_area(text) from public;
grant execute on function public.list_shop_products_for_area(text) to authenticated;

create or replace function public.list_shop_products()
returns setof public.products
language sql
stable
security definer
set search_path = public
as $$
  select * from public.list_shop_products_for_area('shop');
$$;

revoke all on function public.list_shop_products() from public;
grant execute on function public.list_shop_products() to authenticated;

drop function if exists public.get_shop_product_by_code(text);

create or replace function public.get_shop_product_by_code(_code text, _shop_area text default 'shop')
returns public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _row public.products;
begin
  select * into _row
  from public.list_shop_products_for_area(_shop_area)
  where code = upper(trim(_code))
  limit 1;
  return _row;
end;
$$;

revoke all on function public.get_shop_product_by_code(text, text) from public;
grant execute on function public.get_shop_product_by_code(text, text) to authenticated;

create or replace function public.ensure_shop_area_cart(_shop_area text)
returns public.carts
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _cart public.carts;
  _cart_name text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if not public.user_can_access_shop_area(_uid, _shop_area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  select * into _cart
  from public.carts
  where user_id = _uid
    and shop_area = _shop_area
    and deleted_at is null
    and status in ('draft', 'ready')
  order by is_active_cart desc, updated_at desc
  limit 1
  for update;

  if not found then
    select coalesce(nullif(trim(username), ''), 'Warenkorb') into _cart_name
    from public.profiles where id = _uid;
    if _cart_name is null then
      _cart_name := 'Warenkorb';
    end if;

    insert into public.carts (user_id, name, status, is_active_cart, shop_area)
    values (_uid, _cart_name, 'draft', false, _shop_area)
    returning * into _cart;
  end if;

  update public.carts
  set is_active_cart = false
  where user_id = _uid and is_active_cart = true and id <> _cart.id and status <> 'ordered';

  update public.carts
  set is_active_cart = true
  where id = _cart.id
  returning * into _cart;

  return _cart;
end;
$$;

revoke all on function public.ensure_shop_area_cart(text) from public;
grant execute on function public.ensure_shop_area_cart(text) to authenticated;

create or replace function public.first_accessible_group_buy_area(_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.key
  from public.shop_areas a
  where a.is_active
    and a.pricing_profile = 'group_buy'
    and public.user_can_access_shop_area(_user_id, a.key)
  order by a.sort_order
  limit 1;
$$;

revoke all on function public.first_accessible_group_buy_area(uuid) from public, anon, authenticated;

create or replace function public.kit_share_target_cart_id(_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
  _cart_id uuid;
  _cart_name text;
begin
  _area := public.first_accessible_group_buy_area(_user_id);
  if _area is null then
    raise exception 'Kits sind nur in Group-Buy-Bereichen verfügbar.' using errcode = '42501';
  end if;

  select id into _cart_id
  from public.carts
  where user_id = _user_id
    and shop_area = _area
    and deleted_at is null
    and status in ('draft', 'ready')
  order by is_active_cart desc, updated_at desc
  limit 1
  for update;

  if _cart_id is null then
    select coalesce(nullif(trim(username), ''), 'Warenkorb') into _cart_name
    from public.profiles where id = _user_id;
    if _cart_name is null then
      _cart_name := 'Warenkorb';
    end if;
    insert into public.carts (user_id, name, status, is_active_cart, shop_area)
    values (_user_id, _cart_name, 'draft', false, _area)
    returning id into _cart_id;
  end if;

  return _cart_id;
end;
$$;

revoke all on function public.kit_share_target_cart_id(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cart sync, checkout, kit cart sync — shop-area aware
-- ---------------------------------------------------------------------------

create or replace function public.sync_cart_selling_prices(_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _area text;
  _markup numeric;
  _item record;
  _product public.products;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _rate numeric;
  _line numeric;
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

    _sell := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, coalesce(_area, 'shop'));
    _normal := public.shop_area_sell_unit_price(_product, 1, _markup, coalesce(_area, 'shop'));

    if public.shop_area_pricing_profile(coalesce(_area, 'shop')) = 'retail'
       and public.product_uses_kit_unit_pricing(_product) then
      _bulk := null;
      _tier := 'normal';
    else
      if _product.bulk_price_usd is not null and _product.bulk_price_min_quantity is not null and _product.bulk_price_min_quantity > 0 then
        _bulk := public.apply_role_markup(
          public.catalog_bulk_unit_price(_product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity),
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
      unit_price_usd_snapshot = _sell,
      normal_price_usd_snapshot = _normal,
      bulk_price_usd_snapshot = _bulk,
      bulk_price_min_quantity_snapshot = _product.bulk_price_min_quantity,
      applied_price_tier = _tier,
      eur_value_snapshot = case when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2) else eur_value_snapshot end,
      price_snapshot_at = now(),
      resolution_status = 'resolved',
      product_code_snapshot = _product.code,
      product_name_snapshot = _product.name
    where id = _item.id;
  end loop;
end;
$$;

revoke all on function public.sync_cart_selling_prices(uuid) from public;
grant execute on function public.sync_cart_selling_prices(uuid) to authenticated;

create or replace function public.create_order(
  _cart_id uuid,
  _note text default null,
  _payment_method text default null,
  _shipping_first_name text default null,
  _shipping_last_name text default null,
  _shipping_street text default null,
  _shipping_house_number text default null,
  _shipping_address_extra text default null,
  _shipping_postal_code text default null,
  _shipping_city text default null,
  _shipping_country text default null,
  _shipping_delivery_method text default null,
  _shipping_packstation_number text default null,
  _shipping_post_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart record;
  _area text;
  _item record;
  _product public.products;
  _product_row public.products;
  _order_id uuid;
  _order_item_id uuid;
  _order_number text;
  _position int := 0;
  _line_total numeric(12, 2);
  _total_usd numeric(14, 2) := 0;
  _total_eur numeric(14, 2) := 0;
  _eur_complete boolean := true;
  _line_count int;
  _rate numeric(12, 6);
  _markup numeric;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _eur numeric;
  _kit public.kit_shares;
  _kit_participant public.kit_share_participants;
  _kit_share_ids uuid[];
  _kit_share_id uuid;
  _remaining_unordered int;
  _telegram text;
  _first text;
  _last text;
  _street text;
  _house text;
  _extra text;
  _postal text;
  _city text;
  _country text;
  _delivery text;
  _packstation text;
  _post_number text;
  _role_name text;
  _catalog_unit numeric;
  _base_line numeric(12, 2);
  _allocated integer;
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

  _first := public.require_shipping_text(_shipping_first_name, 'Bitte Vorname angeben.', 80);
  _last := public.require_shipping_text(_shipping_last_name, 'Bitte Nachname angeben.', 80);
  _postal := public.require_shipping_text(_shipping_postal_code, 'Bitte PLZ angeben.', 16);
  _city := public.require_shipping_text(_shipping_city, 'Bitte Ort angeben.', 80);
  _country := public.require_shipping_text(_shipping_country, 'Bitte Land angeben.', 56);

  if _delivery = 'home' then
    _street := public.require_shipping_text(_shipping_street, 'Bitte Straße angeben.', 120);
    _house := public.require_shipping_text(_shipping_house_number, 'Bitte Hausnummer angeben.', 20);
    _extra := nullif(trim(coalesce(_shipping_address_extra, '')), '');
    if _extra is not null and (char_length(_extra) > 120 or _extra ~ '[[:cntrl:]]') then
      raise exception 'Adresszusatz ist ungültig.' using errcode = 'P0001';
    end if;
    _packstation := null;
    _post_number := null;
  else
    _packstation := public.require_shipping_text(_shipping_packstation_number, 'Bitte Packstation Nummer angeben.', 20);
    _post_number := public.require_shipping_text(_shipping_post_number, 'Bitte Postnummer angeben.', 20);
    _street := null;
    _house := null;
    _extra := null;
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

  _markup := public.markup_percent_for(auth.uid());
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

      _sell := _item.unit_price_usd_snapshot;
      _normal := _sell;
      _bulk := null;
      _tier := 'normal';

      update public.kit_share_participants
      set ordered_at = now(), order_id = _order_id, updated_at = now()
      where id = _kit_participant.id;

      if not (_item.kit_share_id = any(coalesce(_kit_share_ids, array[]::uuid[]))) then
        _kit_share_ids := coalesce(_kit_share_ids, array[]::uuid[]) || _item.kit_share_id;
      end if;
    else
      _sell := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _area);
      _normal := public.shop_area_sell_unit_price(_product, 1, _markup, _area);

      if public.shop_area_pricing_profile(_area) = 'retail'
         and public.product_uses_kit_unit_pricing(_product) then
        _bulk := null;
        _tier := 'normal';
      elsif _product.bulk_price_usd is not null and _product.bulk_price_min_quantity is not null and _product.bulk_price_min_quantity > 0 then
        _bulk := public.apply_role_markup(_product.bulk_price_usd, _markup);
        _tier := case when _item.quantity >= _product.bulk_price_min_quantity then 'bulk' else 'normal' end;
      else
        _bulk := null;
        _tier := 'normal';
      end if;
    end if;

    _line_total := round((_item.quantity * _sell)::numeric, 2);
    _total_usd := _total_usd + _line_total;

    _rate := _item.exchange_rate_snapshot;
    if _rate is not null and _rate > 0 then
      _eur := round((_line_total * _rate)::numeric, 2);
      _total_eur := _total_eur + _eur;
    else
      _eur := null;
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
  set total_usd = _total_usd,
      total_eur = case when _eur_complete then _total_eur else null end,
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
      'orderNumber', _order_number,
      'totalUsd', _total_usd,
      'itemCount', _line_count,
      'paymentMethod', _payment_method,
      'deliveryMethod', _delivery,
      'shopArea', _area
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

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

  _cart_id := public.kit_share_target_cart_id(_user_id);

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _markup := public.markup_percent_for(_user_id);
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

-- Kits must never land in a retail (Einzelverkauf) cart, even via direct inserts.
create or replace function public.reject_retail_kit_cart_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
begin
  if NEW.kit_share_id is null then
    return NEW;
  end if;

  select shop_area into _area from public.carts where id = NEW.cart_id;
  if public.shop_area_pricing_profile(coalesce(_area, 'shop')) = 'retail' then
    raise exception 'Kits sind in diesem Shop-Bereich nicht verfügbar.' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

revoke all on function public.reject_retail_kit_cart_item() from public, anon, authenticated;

drop trigger if exists cart_items_reject_retail_kits on public.cart_items;
create trigger cart_items_reject_retail_kits
  before insert or update of kit_share_id on public.cart_items
  for each row execute function public.reject_retail_kit_cart_item();

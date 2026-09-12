-- 0069_dynamic_sales_areas.sql
-- Additive: shop_areas is the only sales-area table. Drop the three-key CHECKs so
-- admins can create areas without a code change. Recalc of open carts uses the
-- existing catalog pipeline (resolve_area_catalog_product + shop_area_sell_unit_price)
-- with the cart owner's global role markup — never the stored cart unit price.

-- ---------------------------------------------------------------------------
-- Identity / status / theme on shop_areas
-- ---------------------------------------------------------------------------

alter table public.shop_areas drop constraint if exists shop_areas_key_check;

alter table public.shop_areas
  add column if not exists slug text,
  add column if not exists short_name text,
  add column if not exists subtitle text,
  add column if not exists description text,
  add column if not exists icon_key text not null default 'store',
  add column if not exists badge_text text,
  add column if not exists badge_color text,
  add column if not exists status text not null default 'active',
  add column if not exists hub_visible boolean not null default true,
  add column if not exists is_system boolean not null default false,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists theme jsonb not null default '{}'::jsonb,
  add column if not exists options jsonb not null default '{}'::jsonb;

alter table public.shop_areas drop constraint if exists shop_areas_status_check;
alter table public.shop_areas
  add constraint shop_areas_status_check
  check (status in ('active', 'disabled', 'coming_soon', 'closed'));

alter table public.shop_areas drop constraint if exists shop_areas_key_format;
alter table public.shop_areas
  add constraint shop_areas_key_format
  check (key ~ '^[a-z][a-z0-9_]{0,62}$');

update public.shop_areas
set
  slug = case key
    when 'shop' then 'retail'
    when 'group_buy_1' then 'group-buy-1'
    when 'group_buy_2' then 'group-buy-2'
    else replace(key, '_', '-')
  end,
  short_name = coalesce(nullif(short_name, ''), name),
  subtitle = coalesce(subtitle, case
    when pricing_profile = 'group_buy' then 'Gemeinsamer Einkauf · Kits · Anteile'
    else 'Einzelverkauf · Vials · Packungen'
  end),
  icon_key = coalesce(nullif(icon_key, ''), case
    when pricing_profile = 'group_buy' then 'users'
    else 'store'
  end),
  is_system = key in ('shop', 'group_buy_1', 'group_buy_2'),
  status = case when is_active then 'active' else 'disabled' end
where slug is null or slug = '';

alter table public.shop_areas alter column slug set not null;

create unique index if not exists shop_areas_slug_uidx on public.shop_areas (slug);

-- ---------------------------------------------------------------------------
-- Carts / orders / kits: any existing shop_areas.key, not a hardcoded trio
-- ---------------------------------------------------------------------------

alter table public.carts drop constraint if exists carts_shop_area_check;
alter table public.orders drop constraint if exists orders_shop_area_check;
alter table public.kit_shares drop constraint if exists kit_shares_shop_area_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'carts_shop_area_fkey') then
    alter table public.carts
      add constraint carts_shop_area_fkey
      foreign key (shop_area) references public.shop_areas (key);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_shop_area_fkey') then
    alter table public.orders
      add constraint orders_shop_area_fkey
      foreign key (shop_area) references public.shop_areas (key);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kit_shares_shop_area_fkey') then
    alter table public.kit_shares
      add constraint kit_shares_shop_area_fkey
      foreign key (shop_area) references public.shop_areas (key);
  end if;
end
$$;

create or replace function public.assert_kit_area_group_buy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.shop_areas a
    where a.key = NEW.shop_area
      and a.pricing_profile = 'group_buy'
  ) then
    raise exception 'Kits sind nur in Group-Buy-Bereichen verfügbar.' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

revoke all on function public.assert_kit_area_group_buy() from public, anon, authenticated;

drop trigger if exists kit_shares_require_group_buy on public.kit_shares;
create trigger kit_shares_require_group_buy
  before insert or update of shop_area on public.kit_shares
  for each row execute function public.assert_kit_area_group_buy();

-- ---------------------------------------------------------------------------
-- Purchasable vs listed
-- ---------------------------------------------------------------------------

create or replace function public.shop_area_is_purchasable(_area_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_areas a
    where a.key = _area_key
      and a.is_active
      and a.status = 'active'
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at is null or a.ends_at >= now())
  );
$$;

revoke all on function public.shop_area_is_purchasable(text) from public, anon, authenticated;

create or replace function public.shop_area_is_listed(_area_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_areas a
    where a.key = _area_key
      and a.is_active
      and a.hub_visible
      and a.status in ('active', 'coming_soon')
      and (a.starts_at is null or a.starts_at <= now() or a.status = 'coming_soon')
      and (a.ends_at is null or a.ends_at >= now())
  );
$$;

revoke all on function public.shop_area_is_listed(text) from public, anon, authenticated;

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
    and public.shop_area_is_purchasable(_area_key)
    and (
      exists (
        select 1
        from public.shop_areas a
        join public.shop_area_role_access x on x.shop_area_key = a.key
        join public.user_customer_roles u on u.role_id = x.role_id
        where a.key = _area_key
          and u.user_id = _user_id
      )
      or exists (
        select 1
        from public.shop_areas a
        join public.shop_area_role_access x on x.shop_area_key = a.key
        join public.customer_roles r on r.id = x.role_id
        where a.key = _area_key
          and r.is_default
          and not exists (select 1 from public.user_customer_roles u where u.user_id = _user_id)
      )
    );
$$;

revoke all on function public.user_can_access_shop_area(uuid, text) from public, anon, authenticated;

create or replace function public.user_can_see_shop_area(_user_id uuid, _area_key text)
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
    and public.shop_area_is_listed(_area_key)
    and (
      exists (
        select 1
        from public.shop_area_role_access x
        join public.user_customer_roles u on u.role_id = x.role_id
        where x.shop_area_key = _area_key
          and u.user_id = _user_id
      )
      or exists (
        select 1
        from public.shop_area_role_access x
        join public.customer_roles r on r.id = x.role_id
        where x.shop_area_key = _area_key
          and r.is_default
          and not exists (select 1 from public.user_customer_roles u where u.user_id = _user_id)
      )
    );
$$;

revoke all on function public.user_can_see_shop_area(uuid, text) from public, anon, authenticated;

drop function if exists public.list_my_shop_areas();

create or replace function public.list_my_shop_areas()
returns table (
  key text,
  slug text,
  name text,
  short_name text,
  subtitle text,
  description text,
  icon_key text,
  badge_text text,
  badge_color text,
  status text,
  pricing_profile text,
  sort_order integer,
  path text,
  base_price_factor_pct numeric,
  theme jsonb,
  options jsonb,
  purchasable boolean
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
    a.slug,
    a.name,
    coalesce(a.short_name, a.name),
    a.subtitle,
    a.description,
    a.icon_key,
    a.badge_text,
    a.badge_color,
    a.status,
    a.pricing_profile,
    a.sort_order,
    '/shop/' || a.slug,
    a.base_price_factor_pct,
    a.theme,
    a.options,
    public.user_can_access_shop_area(_uid, a.key)
  from public.shop_areas a
  where public.user_can_see_shop_area(_uid, a.key)
  order by a.sort_order, a.name;
end;
$$;

revoke all on function public.list_my_shop_areas() from public;
grant execute on function public.list_my_shop_areas() to authenticated;

-- ---------------------------------------------------------------------------
-- Slug helper + create / duplicate
-- ---------------------------------------------------------------------------

create or replace function public.shop_area_slugify(_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  _s text;
begin
  _s := lower(btrim(coalesce(_name, '')));
  _s := replace(_s, 'ä', 'ae');
  _s := replace(_s, 'ö', 'oe');
  _s := replace(_s, 'ü', 'ue');
  _s := replace(_s, 'ß', 'ss');
  _s := regexp_replace(_s, '[^a-z0-9]+', '-', 'g');
  _s := trim(both '-' from _s);
  if _s is null or _s = '' then
    _s := 'bereich';
  end if;
  return left(_s, 48);
end;
$$;

revoke all on function public.shop_area_slugify(text) from public, anon;
grant execute on function public.shop_area_slugify(text) to authenticated;

create or replace function public.admin_create_shop_area(
  _name text,
  _template text default 'empty',
  _source_key text default null,
  _copy_categories boolean default true,
  _copy_roles boolean default true,
  _copy_design boolean default true
)
returns public.shop_areas
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _slug text;
  _key text;
  _n int := 0;
  _src public.shop_areas;
  _row public.shop_areas;
  _profile text;
  _factor numeric;
  _max_sort integer;
begin
  if _uid is null or not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  _slug := public.shop_area_slugify(_name);
  _key := replace(_slug, '-', '_');

  while exists (select 1 from public.shop_areas where key = _key or slug = _slug) loop
    _n := _n + 1;
    _slug := left(public.shop_area_slugify(_name), 40) || '-' || _n::text;
    _key := replace(_slug, '-', '_');
  end loop;

  _template := coalesce(nullif(btrim(_template), ''), 'empty');
  if _template = 'duplicate' then
    select * into _src from public.shop_areas where key = _source_key;
    if not found then
      raise exception 'Vorlagenbereich nicht gefunden.' using errcode = 'P0001';
    end if;
  elsif _template = 'group_buy' then
    select * into _src from public.shop_areas where key = 'group_buy_1';
  elsif _template in ('retail', 'peptix') then
    select * into _src from public.shop_areas where key = 'shop';
  else
    _src := null;
  end if;

  _profile := coalesce(_src.pricing_profile, case when _template = 'group_buy' then 'group_buy' else 'retail' end);
  _factor := coalesce(_src.base_price_factor_pct, 100);
  select coalesce(max(sort_order), 0) + 10 into _max_sort from public.shop_areas;

  insert into public.shop_areas (
    key, slug, name, short_name, subtitle, description, icon_key, badge_text, badge_color,
    is_active, status, hub_visible, is_system, pricing_profile, retail_price_factor,
    kit_unit_divisor, base_price_factor_pct, sort_order, theme, options
  ) values (
    _key,
    _slug,
    btrim(_name),
    btrim(_name),
    case when _copy_design then _src.subtitle else
      case when _profile = 'group_buy' then 'Gemeinsamer Einkauf · Kits · Anteile' else 'Einzelverkauf · Vials · Packungen' end
    end,
    case when _copy_design then _src.description else null end,
    coalesce(case when _copy_design then _src.icon_key end, case when _profile = 'group_buy' then 'users' else 'store' end),
    case when _copy_design then _src.badge_text else null end,
    case when _copy_design then _src.badge_color else null end,
    true,
    'active',
    true,
    false,
    _profile,
    coalesce(_src.retail_price_factor, 5),
    coalesce(_src.kit_unit_divisor, 10),
    _factor,
    _max_sort,
    case when _copy_design then coalesce(_src.theme, '{}'::jsonb) else '{}'::jsonb end,
    case when _copy_design then coalesce(_src.options, '{}'::jsonb) else '{}'::jsonb end
  )
  returning * into _row;

  if _copy_categories and _src.key is not null then
    insert into public.shop_area_categories (shop_area_key, category_key, label, sort_order, is_active)
    select _row.key, c.category_key, c.label, c.sort_order, c.is_active
    from public.shop_area_categories c
    where c.shop_area_key = _src.key
    on conflict do nothing;
  elsif _src.key is null then
    insert into public.shop_area_categories (shop_area_key, category_key, label, sort_order, is_active)
    select _row.key, c.category_key, c.label, c.sort_order, true
    from public.shop_area_categories c
    where c.shop_area_key = 'shop'
    on conflict do nothing;
  end if;

  if _copy_roles and _src.key is not null then
    insert into public.shop_area_role_access (shop_area_key, role_id)
    select _row.key, x.role_id
    from public.shop_area_role_access x
    where x.shop_area_key = _src.key
    on conflict do nothing;
  elsif _src.key is null then
    insert into public.shop_area_role_access (shop_area_key, role_id)
    select _row.key, r.id from public.customer_roles r where r.is_default
    on conflict do nothing;
  end if;

  return _row;
end;
$$;

revoke all on function public.admin_create_shop_area(text, text, text, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.admin_create_shop_area(text, text, text, boolean, boolean, boolean)
  to authenticated;

create or replace function public.admin_set_shop_area_inactive(_area_key text)
returns public.shop_areas
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _row public.shop_areas;
begin
  if _uid is null or not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  update public.shop_areas
  set is_active = false, status = 'disabled', hub_visible = false
  where key = _area_key
  returning * into _row;

  if not found then
    raise exception 'Bereich nicht gefunden.' using errcode = 'P0001';
  end if;
  return _row;
end;
$$;

revoke all on function public.admin_set_shop_area_inactive(text) from public, anon;
grant execute on function public.admin_set_shop_area_inactive(text) to authenticated;

create or replace function public.admin_delete_shop_area(_area_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _area public.shop_areas;
begin
  if _uid is null or not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  select * into _area from public.shop_areas where key = _area_key;
  if not found then
    raise exception 'Bereich nicht gefunden.' using errcode = 'P0001';
  end if;
  if _area.is_system then
    raise exception 'Systembereiche können nicht gelöscht werden.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.carts where shop_area = _area_key)
     or exists (select 1 from public.orders where shop_area = _area_key)
     or exists (select 1 from public.shop_area_products where shop_area_key = _area_key)
     or exists (select 1 from public.kit_shares where shop_area = _area_key) then
    raise exception 'Bereich ist in Verwendung und darf nur deaktiviert werden.' using errcode = 'P0001';
  end if;

  delete from public.shop_areas where key = _area_key;
end;
$$;

revoke all on function public.admin_delete_shop_area(text) from public, anon;
grant execute on function public.admin_delete_shop_area(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Open-cart price refresh (admin). Never uses stored cart unit as the basis.
-- ---------------------------------------------------------------------------

create or replace function public.admin_preview_open_cart_price_refresh()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _carts integer;
  _items integer;
begin
  if _uid is null or not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  select count(*)::int into _carts
  from public.carts
  where deleted_at is null
    and status in ('draft', 'ready');

  select count(*)::int into _items
  from public.cart_items i
  join public.carts c on c.id = i.cart_id
  where c.deleted_at is null
    and c.status in ('draft', 'ready')
    and i.kit_share_id is null
    and i.resolution_status = 'resolved';

  return jsonb_build_object('carts', _carts, 'items', _items);
end;
$$;

revoke all on function public.admin_preview_open_cart_price_refresh() from public, anon;
grant execute on function public.admin_preview_open_cart_price_refresh() to authenticated;

create or replace function public.refresh_cart_selling_prices_for_user(_cart_id uuid, _user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
  _area_factor numeric := 1.0;
  _markup numeric;
  _item record;
  _product public.products;
  _p_for_bulk public.products;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _rate numeric;
  _line numeric;
  _discounts boolean;
  _code text;
  _updated integer := 0;
begin
  if not exists (
    select 1 from public.carts
    where id = _cart_id
      and user_id = _user_id
      and deleted_at is null
      and status in ('draft', 'ready')
  ) then
    return 0;
  end if;

  select shop_area into _area from public.carts where id = _cart_id;
  _markup := public.markup_percent_for(_user_id);
  _discounts := public.quantity_discounts_enabled();

  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = coalesce(_area, 'shop');
  _area_factor := coalesce(_area_factor, 1.0);

  for _item in
    select * from public.cart_items
    where cart_id = _cart_id
      and kit_share_id is null
      and resolution_status = 'resolved'
  loop
    _code := coalesce(
      nullif(btrim(coalesce(_item.vendor_code, '')), ''),
      nullif(btrim(coalesce(_item.product_code_snapshot, '')), ''),
      nullif(btrim(coalesce(_item.product_code_input, '')), '')
    );
    _product := public.resolve_area_catalog_product(coalesce(_area, 'shop'), _code, _item.product_id);
    if _product.id is null or not _product.is_active then
      continue;
    end if;

    -- Authoritative catalog unit for this area × current owner markup. Never _item.unit_price_usd_snapshot.
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
      version                          = version + 1,
      updated_at                       = now()
    where id = _item.id;

    _updated := _updated + 1;
  end loop;

  return _updated;
end;
$$;

revoke all on function public.refresh_cart_selling_prices_for_user(uuid, uuid) from public, anon, authenticated;

create or replace function public.sync_cart_selling_prices(_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  perform public.assert_public_site_access();
  perform public.refresh_cart_selling_prices_for_user(_cart_id, _uid);
end;
$$;

revoke all on function public.sync_cart_selling_prices(uuid) from public;
grant execute on function public.sync_cart_selling_prices(uuid) to authenticated;

create or replace function public.admin_refresh_open_cart_prices()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _cart record;
  _carts integer := 0;
  _items integer := 0;
  _n integer;
begin
  if _uid is null or not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  for _cart in
    select id, user_id
    from public.carts
    where deleted_at is null
      and status in ('draft', 'ready')
    order by created_at
  loop
    _n := public.refresh_cart_selling_prices_for_user(_cart.id, _cart.user_id);
    _carts := _carts + 1;
    _items := _items + _n;
  end loop;

  return jsonb_build_object('carts', _carts, 'items', _items);
end;
$$;

revoke all on function public.admin_refresh_open_cart_prices() from public, anon;
grant execute on function public.admin_refresh_open_cart_prices() to authenticated;

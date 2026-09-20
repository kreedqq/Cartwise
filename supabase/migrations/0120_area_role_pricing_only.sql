-- 0120_area_role_pricing_only.sql
-- Role sell prices come ONLY from shop_area_role_sell_factors (no customer_roles.markup_percent fallback).

-- Backfill explicit area×role factors (default 100 % pass-through).
insert into public.shop_area_role_sell_factors (shop_area_key, role_id, sell_factor_pct)
select sa.key, cr.id, 100
from public.shop_areas sa
cross join public.customer_roles cr
where not exists (
    select 1
    from public.shop_area_role_sell_factors s
    where s.shop_area_key = sa.key
      and s.role_id = cr.id
  );

create or replace function public.seed_shop_area_role_sell_factors(
  _area_key text,
  _copy_from_area_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _copy_from_area_key is not null and btrim(_copy_from_area_key) <> '' then
    insert into public.shop_area_role_sell_factors (shop_area_key, role_id, sell_factor_pct)
    select _area_key, s.role_id, s.sell_factor_pct
    from public.shop_area_role_sell_factors s
    where s.shop_area_key = _copy_from_area_key
    on conflict (shop_area_key, role_id) do nothing;
  end if;

  insert into public.shop_area_role_sell_factors (shop_area_key, role_id, sell_factor_pct)
  select _area_key, cr.id, 100
  from public.customer_roles cr
  where not exists (
      select 1
      from public.shop_area_role_sell_factors s
      where s.shop_area_key = _area_key
        and s.role_id = cr.id
    );
end;
$$;

revoke all on function public.seed_shop_area_role_sell_factors(text, text) from public, anon;
grant execute on function public.seed_shop_area_role_sell_factors(text, text) to authenticated;

create or replace function public.markup_percent_for_area(
  _user_id uuid,
  _area_key text,
  _product_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _sell_factor numeric;
begin
  _sell_factor := public.shop_area_role_sell_factor_pct(_user_id, _area_key);
  if _sell_factor is null then
    _sell_factor := 100;
  end if;
  return public.sell_factor_pct_to_role_markup_percent(_sell_factor);
end;
$$;

revoke all on function public.markup_percent_for_area(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.markup_percent_for_area(uuid, text, uuid) to authenticated;

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
  _duplicate boolean := false;
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
    _duplicate := true;
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

  if _duplicate and _src.key is not null then
    perform public.seed_shop_area_role_sell_factors(_row.key, _src.key);
  else
    perform public.seed_shop_area_role_sell_factors(_row.key, null);
  end if;

  return _row;
end;
$$;

revoke all on function public.admin_create_shop_area(text, text, text, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.admin_create_shop_area(text, text, text, boolean, boolean, boolean)
  to authenticated;

create or replace function public.admin_upsert_customer_role(
  _id uuid,
  _name text,
  _markup_percent numeric,
  _is_active boolean,
  _can_use_kit_requests boolean default false
)
returns public.customer_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.customer_roles;
  _is_insert boolean := _id is null;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Rollen verwalten.' using errcode = '42501';
  end if;

  _name := trim(_name);
  if _name = '' then
    raise exception 'Rollenname darf nicht leer sein.' using errcode = '23514';
  end if;
  if _markup_percent is null or _markup_percent <= 0 or _markup_percent > 1000 then
    raise exception 'Ungültiger Verkaufspreisfaktor.' using errcode = '22023';
  end if;

  if _is_insert then
    insert into public.customer_roles (name, markup_percent, is_active, can_use_kit_requests)
    values (_name, _markup_percent, coalesce(_is_active, true), coalesce(_can_use_kit_requests, false))
    returning * into _row;

    insert into public.shop_area_role_sell_factors (shop_area_key, role_id, sell_factor_pct)
    select sa.key, _row.id, 100
    from public.shop_areas sa
    on conflict (shop_area_key, role_id) do nothing;
  else
    update public.customer_roles
    set name = _name,
        markup_percent = _markup_percent,
        is_active = coalesce(_is_active, is_active),
        can_use_kit_requests = coalesce(_can_use_kit_requests, can_use_kit_requests)
    where id = _id
    returning * into _row;
    if not found then
      raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
    end if;
  end if;

  perform public.log_audit(auth.uid(), 'customer_role.upsert', 'customer_role', _row.id, null,
    jsonb_build_object(
      'name', _row.name,
      'sellFactorPctLegacyColumn', _row.markup_percent,
      'isActive', _row.is_active,
      'canUseKitRequests', _row.can_use_kit_requests
    )
  );

  return _row;
end;
$$;

revoke all on function public.admin_upsert_customer_role(uuid, text, numeric, boolean, boolean) from public, anon;
grant execute on function public.admin_upsert_customer_role(uuid, text, numeric, boolean, boolean) to authenticated;

comment on column public.customer_roles.markup_percent is
  'Legacy column; not used for shop pricing after 0120. Area role factors live in shop_area_role_sell_factors.';

comment on table public.shop_area_role_sell_factors is
  'Sell multiplier (×100 on area catalog unit) per shop area and customer role. Required for pricing; no global fallback.';

-- Cart repricing: area×role markup for cart owner (not customer_roles.markup_percent).
create or replace function public.shop_area_sell_unit_price(
  _product  public.products,
  _qty      numeric,
  _percent  numeric,
  _area_key text,
  _pricing_user_id uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _p   public.products := public.apply_shop_area_product_overrides(_product, _area_key);
  _pct numeric;
  _uid uuid := coalesce(_pricing_user_id, auth.uid());
begin
  if _uid is not null then
    _pct := public.markup_percent_for_area(_uid, _area_key, _p.id);
  else
    _pct := coalesce(_percent, 0);
  end if;

  return public.apply_role_markup(
    public.shop_area_catalog_unit(_p, _qty, _area_key),
    _pct
  );
end;
$$;

revoke all on function public.shop_area_sell_unit_price(public.products, numeric, numeric, text, uuid)
  from public, anon, authenticated;

create or replace function public.refresh_cart_selling_prices_for_user(_cart_id uuid, _user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart_area text;
  _item record;
  _area text;
  _area_factor numeric := 1.0;
  _markup numeric;
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

  select shop_area into _cart_area from public.carts where id = _cart_id;
  _discounts := public.quantity_discounts_enabled();

  for _item in
    select * from public.cart_items
    where cart_id = _cart_id
      and kit_share_id is null
      and resolution_status = 'resolved'
      and submitted_order_id is null
  loop
    _area := public.cart_item_shop_area(_item.shop_area, _cart_area);
    _code := coalesce(
      nullif(btrim(coalesce(_item.vendor_code, '')), ''),
      nullif(btrim(coalesce(_item.product_code_snapshot, '')), ''),
      nullif(btrim(coalesce(_item.product_code_input, '')), '')
    );
    _product := public.resolve_area_catalog_product(_area, _code, _item.product_id);
    if _product.id is null or not _product.is_active then
      continue;
    end if;

    select base_price_factor_pct / 100.0
    into _area_factor
    from public.shop_areas
    where key = _area;
    _area_factor := coalesce(_area_factor, 1.0);

    _markup := public.markup_percent_for_area(_user_id, _area, _product.id);

    _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _area, _user_id);
    _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, _area, _user_id);

    if public.shop_area_pricing_profile(_area) = 'retail'
       and public.product_uses_kit_unit_pricing(_product) then
      _bulk := null;
      _tier := 'normal';
    elsif _discounts
          and _product.bulk_price_usd is not null
          and _product.bulk_price_min_quantity is not null
          and _product.bulk_price_min_quantity > 0 then
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
grant execute on function public.refresh_cart_selling_prices_for_user(uuid, uuid) to authenticated;

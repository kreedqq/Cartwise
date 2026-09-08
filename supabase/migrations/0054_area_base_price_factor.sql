-- 0054_area_base_price_factor.sql
-- Adds base_price_factor_pct to shop_areas.
-- New pricing formulas:
--   Retail:    (import_price / kit_unit_divisor) × (base_price_factor_pct / 100)
--   Group Buy:  sell_unit_price × (base_price_factor_pct / 100)
-- retail_price_factor column is RETAINED (legacy) but no longer used in the pricing pipeline.
-- No destructive changes to tables, policies, or cart/order security objects.

-- ---------------------------------------------------------------------------
-- Schema: add base_price_factor_pct
-- ---------------------------------------------------------------------------

alter table public.shop_areas
  add column if not exists base_price_factor_pct numeric(8, 2) not null default 100
  constraint shop_areas_base_price_factor_pct_check check (base_price_factor_pct > 0);

comment on column public.shop_areas.base_price_factor_pct is
  'Price multiplier expressed as a percentage (100 = 1×, 300 = 3×, 150 = 1.5×). Applied to all pricing profiles. Replaces retail_price_factor in the active pricing pipeline. retail_price_factor is retained for legacy reference only.';

-- ---------------------------------------------------------------------------
-- Initial values
-- ---------------------------------------------------------------------------

-- Shop (retail) starts at 300 % (3× multiplier).
-- Group Buy areas default to 100 % (1× – pass-through, no change to existing prices).
update public.shop_areas set base_price_factor_pct = 300 where key = 'shop';
-- group_buy_1 and group_buy_2 stay at DEFAULT 100.

-- ---------------------------------------------------------------------------
-- shop_area_catalog_unit: replaces 0052 version
-- Uses base_price_factor_pct for both retail and group_buy.
-- ---------------------------------------------------------------------------

create or replace function public.shop_area_catalog_unit(
  _product public.products,
  _qty     numeric,
  _area_key text
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _area    public.shop_areas;
  _p       public.products;
  _factor  numeric;
  _divisor numeric;
  _unit    numeric;
begin
  select * into _area from public.shop_areas where key = _area_key;
  if not found then
    raise exception 'Unbekannter Shop-Bereich.' using errcode = 'P0001';
  end if;

  -- Apply per-area catalog price overrides first (from 0052).
  _p      := public.apply_shop_area_product_overrides(_product, _area_key);
  _factor := _area.base_price_factor_pct / 100.0;

  -- Group Buy: sell_unit_price (quantity-tier aware) × factor.
  if _area.pricing_profile = 'group_buy' then
    return public.sell_unit_price(
      _p.price_usd, _p.bulk_price_usd, _p.bulk_price_min_quantity,
      _qty, 0
    ) * _factor;
  end if;

  -- Retail: kit products use kit_unit_divisor; all others use quantity-tier unit price.
  _divisor := _area.kit_unit_divisor;

  if public.product_uses_kit_unit_pricing(_p) then
    return (_p.price_usd / _divisor) * _factor;
  end if;

  _unit := public.sell_unit_price(
    _p.price_usd, _p.bulk_price_usd, _p.bulk_price_min_quantity,
    _qty, 0
  );
  return _unit * _factor;
end;
$$;

revoke all on function public.shop_area_catalog_unit(public.products, numeric, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- shop_area_sell_unit_price: recreate (body unchanged; picks up new catalog_unit)
-- ---------------------------------------------------------------------------

create or replace function public.shop_area_sell_unit_price(
  _product  public.products,
  _qty      numeric,
  _percent  numeric,
  _area_key text
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
begin
  if auth.uid() is not null then
    _pct := public.markup_percent_for_area(auth.uid(), _area_key, _p.id);
  else
    _pct := coalesce(_percent, 0);
  end if;

  return public.apply_role_markup(
    public.shop_area_catalog_unit(_p, _qty, _area_key),
    _pct
  );
end;
$$;

revoke all on function public.shop_area_sell_unit_price(public.products, numeric, numeric, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_shop_products_for_area: replaces 0052 version
-- Applies base_price_factor_pct for all pricing profiles, including group_buy.
-- ---------------------------------------------------------------------------

create or replace function public.list_shop_products_for_area(_shop_area text)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid         uuid := auth.uid();
  _area        public.shop_areas;
  _p           public.products;
  _src         public.products;
  _pct         numeric;
  _factor      numeric;
  _divisor     numeric;
  _catalog_unit numeric;
  _src_price   numeric;
  _src_bulk    numeric;
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

  _factor  := _area.base_price_factor_pct / 100.0;
  _divisor := _area.kit_unit_divisor;

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

    if _area.pricing_profile = 'group_buy' then
      -- Group Buy: factor applied to both normal and bulk unit prices.
      _p.price_usd := public.apply_role_markup(_src_price * _factor, _pct)::numeric(12, 4);
      if _src_bulk is not null and _p.bulk_price_min_quantity is not null and _p.bulk_price_min_quantity > 0 then
        _p.bulk_price_usd := public.apply_role_markup(
          public.catalog_bulk_unit_price(_src_price, _src_bulk, _p.bulk_price_min_quantity) * _factor,
          _pct
        )::numeric(12, 4);
      else
        _p.bulk_price_usd := null;
      end if;
    else
      -- Retail: catalog unit is either kit-divisor price or quantity-tier unit × factor.
      if public.product_uses_kit_unit_pricing(_p) then
        _catalog_unit := (_src_price / _divisor) * _factor;
      else
        _catalog_unit := public.sell_unit_price(
          _src_price, _src_bulk, _p.bulk_price_min_quantity, 1, 0
        ) * _factor;
      end if;
      _p.price_usd             := public.apply_role_markup(_catalog_unit, _pct)::numeric(12, 4);
      _p.bulk_price_usd        := null;
      _p.bulk_price_min_quantity := null;
    end if;
    return next _p;
  end loop;
end;
$$;

revoke all on function public.list_shop_products_for_area(text) from public;
grant execute on function public.list_shop_products_for_area(text) to authenticated;

-- ---------------------------------------------------------------------------
-- list_my_shop_areas: add base_price_factor_pct to return type
-- Must DROP first because return type (OUT columns) changes.
-- ---------------------------------------------------------------------------

drop function if exists public.list_my_shop_areas();

create or replace function public.list_my_shop_areas()
returns table (
  key                  text,
  name                 text,
  pricing_profile      text,
  sort_order           integer,
  path                 text,
  base_price_factor_pct numeric
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
      when 'shop'        then '/shop/retail'
      when 'group_buy_1' then '/shop/group-buy-1'
      when 'group_buy_2' then '/shop/group-buy-2'
      else '/shop'
    end,
    a.base_price_factor_pct
  from public.shop_areas a
  where a.is_active
    and public.user_can_access_shop_area(_uid, a.key)
  order by a.sort_order, a.name;
end;
$$;

revoke all on function public.list_my_shop_areas() from public;
grant execute on function public.list_my_shop_areas() to authenticated;

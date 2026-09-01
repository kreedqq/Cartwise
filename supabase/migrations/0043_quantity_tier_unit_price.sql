-- 0043_quantity_tier_unit_price.sql
-- Injectable Oils store bulk_price_usd as a pack total for
-- bulk_price_min_quantity pieces (e.g. 160 USD for 10 × 16 USD/unit).
-- Peptides/orals already store a per-unit bulk (e.g. 55 vs 60).
--
-- Discriminator: bulk > single-unit price AND min > 1 → pack total.
-- Do not key this on category. Do not rewrite product rows.
-- Kit functions (kit_share_catalog_unit_usd) are unchanged.

create or replace function public.catalog_bulk_unit_price(
  _price numeric,
  _bulk numeric,
  _bulk_min numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when _bulk is null then null
    when _price is not null
      and _bulk > _price
      and _bulk_min is not null
      and _bulk_min > 1
      then _bulk / _bulk_min
    else _bulk
  end;
$$;

comment on function public.catalog_bulk_unit_price(numeric, numeric, numeric) is
  'Catalog bulk as a per-unit price. Pack totals (bulk > unit price, min > 1) are divided by min quantity; already-unit bulks are returned unchanged.';

create or replace function public.selling_prices_for(_user_id uuid, _price numeric, _bulk numeric, _bulk_min numeric)
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
  if _bulk is not null and _bulk_min is not null and _bulk_min > 0 then
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

create or replace function public.sell_unit_price(_price numeric, _bulk numeric, _bulk_min numeric, _qty numeric, _percent numeric)
returns numeric
language sql
immutable
as $$
  select public.apply_role_markup(
    case
      when _bulk is not null and _bulk_min is not null and _bulk_min > 0 and _qty is not null and _qty >= _bulk_min
        then public.catalog_bulk_unit_price(_price, _bulk, _bulk_min)
      else _price
    end,
    _percent
  );
$$;

create or replace function public.sync_cart_selling_prices(_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _markup numeric;
  _item record;
  _product record;
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

    _normal := public.apply_role_markup(_product.price_usd, _markup);
    if _product.bulk_price_usd is not null and _product.bulk_price_min_quantity is not null and _product.bulk_price_min_quantity > 0 then
      _bulk := public.apply_role_markup(
        public.catalog_bulk_unit_price(_product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity),
        _markup
      );
    else
      _bulk := null;
    end if;

    _sell := public.sell_unit_price(
      _product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity,
      _item.quantity, _markup
    );
    _tier := case
      when _bulk is not null and _item.quantity >= _product.bulk_price_min_quantity then 'bulk'
      else 'normal'
    end;
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

revoke all on function public.catalog_bulk_unit_price(numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.selling_prices_for(uuid, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.sell_unit_price(numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.sync_cart_selling_prices(uuid) from public;
grant execute on function public.sync_cart_selling_prices(uuid) to authenticated;

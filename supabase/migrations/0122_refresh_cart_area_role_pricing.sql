-- 0122_refresh_cart_area_role_pricing.sql
-- Cart repricing uses markup_percent_for_area per cart line shop area (0120 body; not applied on all envs with 0121 alone).

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

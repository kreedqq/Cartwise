-- 0121: Ensure one shop_area_sell_unit_price overload (0120 added a 5-arg version alongside the 4-arg function).

drop function if exists public.shop_area_sell_unit_price(public.products, numeric, numeric, text);

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

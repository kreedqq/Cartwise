-- 0021_fix_shop_product_rpc_types.sql
-- Root cause of the empty customer shop: list_shop_products() RETURNS SETOF
-- products, but RETURN QUERY selected selling_prices_for.price_usd which is
-- unconstrained numeric. products.price_usd is numeric(12,4). Postgres
-- rejects that as 42804 ("Returned type numeric does not match expected
-- type numeric(12,4) in column 6"), so PostgREST never returns rows.
--
-- Proven on the linked database (298 active products present; the RPC
-- raised 42804; get_shop_product_by_code worked because SELECT INTO
-- assignment-casts). Cast the marked-up amounts to the table typmods.
-- Product listing does not join customer_roles; missing roles still fall
-- back via markup_percent_for (default Kunde, then 0).

create or replace function public.list_shop_products()
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _pct numeric;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _pct := coalesce(public.markup_percent_for(_uid), 0);

  return query
  select
    p.id,
    p.code,
    p.name,
    p.description,
    p.category,
    public.apply_role_markup(p.price_usd, _pct)::numeric(12, 4),
    p.currency,
    p.is_active,
    p.last_price_change_at,
    p.created_at,
    p.updated_at,
    p.dosage_vial,
    case
      when p.bulk_price_usd is not null
           and p.bulk_price_min_quantity is not null
           and p.bulk_price_min_quantity > 0
        then public.apply_role_markup(p.bulk_price_usd, _pct)::numeric(12, 4)
      else null::numeric(12, 4)
    end,
    p.bulk_price_min_quantity
  from public.products p
  where p.is_active = true
  order by p.code;
end;
$$;

create or replace function public.get_shop_product_by_code(_code text)
returns public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _pct numeric;
  _row public.products;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _pct := coalesce(public.markup_percent_for(_uid), 0);

  select
    p.id,
    p.code,
    p.name,
    p.description,
    p.category,
    public.apply_role_markup(p.price_usd, _pct)::numeric(12, 4),
    p.currency,
    p.is_active,
    p.last_price_change_at,
    p.created_at,
    p.updated_at,
    p.dosage_vial,
    case
      when p.bulk_price_usd is not null
           and p.bulk_price_min_quantity is not null
           and p.bulk_price_min_quantity > 0
        then public.apply_role_markup(p.bulk_price_usd, _pct)::numeric(12, 4)
      else null::numeric(12, 4)
    end,
    p.bulk_price_min_quantity
  into _row
  from public.products p
  where p.code = upper(trim(_code));

  return _row;
end;
$$;

revoke all on function public.list_shop_products() from public;
grant execute on function public.list_shop_products() to authenticated;
revoke all on function public.get_shop_product_by_code(text) from public;
grant execute on function public.get_shop_product_by_code(text) to authenticated;

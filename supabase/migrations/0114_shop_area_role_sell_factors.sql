-- 0114_shop_area_role_sell_factors.sql
-- Per shop area + customer role sell factor (multiplier ×100 on area catalog unit).
-- NULL row = inherit global customer_roles.markup_percent via markup_percent_for_area.
-- Explicit 100 = pass-through (not global fallback).

create table if not exists public.shop_area_role_sell_factors (
  shop_area_key   text not null references public.shop_areas (key) on delete cascade,
  role_id         uuid not null references public.customer_roles (id) on delete cascade,
  sell_factor_pct numeric(10, 4) not null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  primary key (shop_area_key, role_id),
  constraint shop_area_role_sell_factors_pct_check check (sell_factor_pct > 0)
);

comment on table public.shop_area_role_sell_factors is
  'Optional sell multiplier (×100 on area catalog unit) per shop area and customer role. Missing row uses global role markup.';

alter table public.shop_area_role_sell_factors enable row level security;

create policy shop_area_role_sell_factors_admin_all
  on public.shop_area_role_sell_factors for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.shop_area_role_sell_factors to authenticated;

create or replace function public.shop_area_role_sell_factor_pct(
  _user_id uuid,
  _area_key text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select s.sell_factor_pct
  from public.shop_area_role_sell_factors s
  where s.shop_area_key = _area_key
    and s.role_id = coalesce(
      (select u.role_id from public.user_customer_roles u where u.user_id = _user_id limit 1),
      (select r.id from public.customer_roles r where r.is_default limit 1)
    )
  limit 1;
$$;

revoke all on function public.shop_area_role_sell_factor_pct(uuid, text) from public, anon, authenticated;
grant execute on function public.shop_area_role_sell_factor_pct(uuid, text) to authenticated;

-- Single hook for all existing apply_role_markup(catalog, markup_percent_for_area(...)) call sites.
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
  if _sell_factor is not null then
    return ((_sell_factor / 100.0) - 1.0) * 100.0;
  end if;
  return public.markup_percent_for(_user_id);
end;
$$;

revoke all on function public.markup_percent_for_area(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.markup_percent_for_area(uuid, text, uuid) to authenticated;

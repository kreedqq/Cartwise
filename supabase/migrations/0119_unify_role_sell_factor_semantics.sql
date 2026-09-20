-- 0119_unify_role_sell_factor_semantics.sql
-- customer_roles.markup_percent becomes global role SELL FACTOR (100 = pass-through).
-- Legacy rows stored additive markup; convert once: factor = markup + 100.
-- shop_area_role_sell_factors unchanged (already sell factors).

comment on column public.customer_roles.markup_percent is
  'Global role sell price factor (% of area catalog unit). 100 = Grundpreis, 125 = 125 % of catalog.';

-- One-time semantic conversion (additive markup → sell factor).
update public.customer_roles
set markup_percent = markup_percent + 100
where markup_percent is not null;

create or replace function public.sell_factor_pct_to_role_markup_percent(_sell_factor_pct numeric)
returns numeric
language sql
immutable
as $$
  select ((coalesce(_sell_factor_pct, 100) / 100.0) - 1.0) * 100.0;
$$;

revoke all on function public.sell_factor_pct_to_role_markup_percent(numeric) from public, anon;
grant execute on function public.sell_factor_pct_to_role_markup_percent(numeric) to authenticated;

create or replace function public.markup_percent_for(_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.sell_factor_pct_to_role_markup_percent(
    coalesce(
      (
        select r.markup_percent
        from public.user_customer_roles u
        join public.customer_roles r on r.id = u.role_id
        where u.user_id = _user_id
        limit 1
      ),
      (select markup_percent from public.customer_roles where is_default limit 1),
      100
    )
  );
$$;

revoke all on function public.markup_percent_for(uuid) from public, anon, authenticated;

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
    return public.sell_factor_pct_to_role_markup_percent(_sell_factor);
  end if;
  return public.markup_percent_for(_user_id);
end;
$$;

revoke all on function public.markup_percent_for_area(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.markup_percent_for_area(uuid, text, uuid) to authenticated;

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

  if _id is null then
    insert into public.customer_roles (name, markup_percent, is_active, can_use_kit_requests)
    values (_name, _markup_percent, coalesce(_is_active, true), coalesce(_can_use_kit_requests, false))
    returning * into _row;
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
      'sellFactorPct', _row.markup_percent,
      'isActive', _row.is_active,
      'canUseKitRequests', _row.can_use_kit_requests
    )
  );

  return _row;
end;
$$;

revoke all on function public.admin_upsert_customer_role(uuid, text, numeric, boolean, boolean) from public, anon;
grant execute on function public.admin_upsert_customer_role(uuid, text, numeric, boolean, boolean) to authenticated;

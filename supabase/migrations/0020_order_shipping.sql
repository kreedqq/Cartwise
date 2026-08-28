-- 0020_order_shipping.sql
-- Two independent shipping kinds stored on the order (historical snapshot):
--   china_shipping_*  – may be split across selected orders (remainder on last)
--   de_shipping_*     – never split; per-order amount exactly as the admin sets
-- Markup is never applied to shipping. Customers cannot write these columns
-- (orders are SELECT-only for authenticated; only the RPCs below UPDATE).

alter table public.orders
  add column if not exists china_shipping_amount numeric(12, 2)
    check (china_shipping_amount is null or china_shipping_amount >= 0),
  add column if not exists china_shipping_currency text
    check (china_shipping_currency is null or china_shipping_currency in ('USD', 'EUR')),
  add column if not exists de_shipping_amount numeric(12, 2)
    check (de_shipping_amount is null or de_shipping_amount >= 0),
  add column if not exists de_shipping_currency text
    check (de_shipping_currency is null or de_shipping_currency in ('USD', 'EUR'));

do $$
begin
  alter table public.orders
    add constraint orders_china_shipping_pair_chk
    check (
      (china_shipping_amount is null and china_shipping_currency is null)
      or (china_shipping_amount is not null and china_shipping_currency is not null)
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.orders
    add constraint orders_de_shipping_pair_chk
    check (
      (de_shipping_amount is null and de_shipping_currency is null)
      or (de_shipping_amount is not null and de_shipping_currency is not null)
    );
exception when duplicate_object then null;
end $$;

create or replace function public.admin_set_de_shipping(
  _order_id uuid,
  _amount numeric,
  _currency text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.orders;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Versandkosten setzen.' using errcode = '42501';
  end if;

  if _amount is null or _amount = 0 then
    update public.orders
    set de_shipping_amount = null, de_shipping_currency = null
    where id = _order_id
    returning * into _row;
  else
    if _amount < 0 then
      raise exception 'Betrag darf nicht negativ sein.' using errcode = '22023';
    end if;
    if _currency is null or _currency not in ('USD', 'EUR') then
      raise exception 'Währung muss USD oder EUR sein.' using errcode = '22023';
    end if;
    update public.orders
    set de_shipping_amount = round(_amount::numeric, 2), de_shipping_currency = _currency
    where id = _order_id
    returning * into _row;
  end if;

  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform public.log_audit(auth.uid(), 'order.de_shipping', 'order', _order_id, null,
    jsonb_build_object('amount', _row.de_shipping_amount, 'currency', _row.de_shipping_currency));
  return _row;
end;
$$;

create or replace function public.admin_clear_china_shipping(_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.orders;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Versandkosten setzen.' using errcode = '42501';
  end if;
  update public.orders
  set china_shipping_amount = null, china_shipping_currency = null
  where id = _order_id
  returning * into _row;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  return _row;
end;
$$;

create or replace function public.admin_preview_china_split(_amount numeric, _order_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _n int;
  _cents bigint;
  _base bigint;
  _rem bigint;
  _i int;
  _shares numeric[] := '{}';
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Versandkosten setzen.' using errcode = '42501';
  end if;
  if _amount is null or _amount < 0 then
    raise exception 'Betrag darf nicht negativ sein.' using errcode = '22023';
  end if;
  _n := coalesce(array_length(_order_ids, 1), 0);
  if _n < 1 then
    raise exception 'Mindestens eine Bestellung auswählen.' using errcode = '22023';
  end if;

  _cents := round(_amount * 100)::bigint;
  _base := _cents / _n;
  _rem := _cents % _n;
  for _i in 1.._n loop
    _shares := _shares || ((_base + case when _i = _n then _rem else 0 end)::numeric / 100);
  end loop;

  return jsonb_build_object('shares', to_jsonb(_shares), 'total', (_cents::numeric / 100), 'count', _n);
end;
$$;

create or replace function public.admin_apply_china_split(
  _amount numeric,
  _currency text,
  _order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _preview jsonb;
  _shares jsonb;
  _i int;
  _n int;
  _share numeric;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Versandkosten setzen.' using errcode = '42501';
  end if;
  if _currency is null or _currency not in ('USD', 'EUR') then
    raise exception 'Währung muss USD oder EUR sein.' using errcode = '22023';
  end if;

  _preview := public.admin_preview_china_split(_amount, _order_ids);
  _shares := _preview -> 'shares';
  _n := coalesce(array_length(_order_ids, 1), 0);

  for _i in 1.._n loop
    _share := (_shares ->> (_i - 1))::numeric;
    update public.orders
    set china_shipping_amount = _share, china_shipping_currency = _currency
    where id = _order_ids[_i];
    if not found then
      raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
    end if;
  end loop;

  perform public.log_audit(auth.uid(), 'order.china_shipping_split', 'order', null, null,
    jsonb_build_object('amount', _amount, 'currency', _currency, 'orderIds', _order_ids, 'shares', _shares));

  return _preview;
end;
$$;

revoke all on function public.admin_set_de_shipping(uuid, numeric, text) from public;
grant execute on function public.admin_set_de_shipping(uuid, numeric, text) to authenticated;
revoke all on function public.admin_clear_china_shipping(uuid) from public;
grant execute on function public.admin_clear_china_shipping(uuid) to authenticated;
revoke all on function public.admin_preview_china_split(numeric, uuid[]) from public;
grant execute on function public.admin_preview_china_split(numeric, uuid[]) to authenticated;
revoke all on function public.admin_apply_china_split(numeric, text, uuid[]) from public;
grant execute on function public.admin_apply_china_split(numeric, text, uuid[]) to authenticated;

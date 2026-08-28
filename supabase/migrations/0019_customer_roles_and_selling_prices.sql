-- 0019_customer_roles_and_selling_prices.sql
-- Dynamic customer pricing roles (Kunde, Stammkunde, VIP, …) with a
-- per-role markup. Markup NEVER leaves the database for a non-admin:
-- customers get selling prices already applied via SECURITY DEFINER RPCs,
-- and products.price_usd is no longer selectable by non-admins.
--
-- user_roles (user/admin) is unchanged - that table is authorization, not
-- pricing. Mixing the two would break has_role(..., 'admin') RLS.

-- ---------------------------------------------------------------------------
-- 1. customer_roles + assignments
-- ---------------------------------------------------------------------------

create table public.customer_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  markup_percent numeric(8, 4) not null default 0
    check (markup_percent >= 0 and markup_percent <= 1000),
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_roles is
  'Admin-configurable pricing roles. markup_percent is an internal business rule and must never be selected by customers.';
comment on column public.customer_roles.markup_percent is
  'Internal markup applied to catalog (bulk-then-markup) selling prices. Not exposed to customers.';

create unique index customer_roles_name_key on public.customer_roles (upper(trim(name)));
create unique index customer_roles_one_default on public.customer_roles (is_default) where is_default;

create trigger customer_roles_set_updated_at
  before update on public.customer_roles
  for each row execute function public.set_updated_at();

create table public.user_customer_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role_id uuid not null references public.customer_roles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.user_customer_roles is
  'One pricing role per user. Customers cannot read this table (role_id would leak internals).';

alter table public.customer_roles enable row level security;
alter table public.user_customer_roles enable row level security;

create policy "customer_roles_admin_all"
  on public.customer_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "user_customer_roles_admin_select"
  on public.user_customer_roles for select
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.customer_roles to authenticated;
grant select on public.user_customer_roles to authenticated;
grant select, insert, update, delete on public.customer_roles to service_role;
grant select, insert, update, delete on public.user_customer_roles to service_role;

insert into public.customer_roles (name, markup_percent, is_active, is_default)
values
  ('Kunde', 25, true, true),
  ('Stammkunde', 0, true, false);

-- Existing users get the default pricing role (Kunde).
insert into public.user_customer_roles (user_id, role_id)
select u.id, r.id
from auth.users u
cross join public.customer_roles r
where r.is_default = true
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Registration: always assign default "Kunde". Client cannot choose.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _default_role uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Neuer Nutzer'))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  select id into _default_role from public.customer_roles where is_default limit 1;
  if _default_role is not null then
    insert into public.user_customer_roles (user_id, role_id)
    values (new.id, _default_role)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Internal pricing helpers - NOT granted to authenticated
-- ---------------------------------------------------------------------------

create or replace function public.apply_role_markup(_amount numeric, _percent numeric)
returns numeric
language sql
immutable
as $$
  select round((_amount * (1 + coalesce(_percent, 0) / 100.0))::numeric, 4);
$$;

create or replace function public.markup_percent_for(_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.markup_percent
      from public.user_customer_roles u
      join public.customer_roles r on r.id = u.role_id
      where u.user_id = _user_id
      limit 1
    ),
    (select markup_percent from public.customer_roles where is_default limit 1),
    0
  );
$$;

create or replace function public.selling_prices_for(_user_id uuid, _price numeric, _bulk numeric, _bulk_min numeric)
returns table (price_usd numeric, bulk_price_usd numeric, bulk_price_min_quantity numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _pct numeric;
begin
  _pct := public.markup_percent_for(_user_id);
  price_usd := public.apply_role_markup(_price, _pct);
  if _bulk is not null and _bulk_min is not null and _bulk_min > 0 then
    bulk_price_usd := public.apply_role_markup(_bulk, _pct);
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
        then _bulk
      else _price
    end,
    _percent
  );
$$;

revoke all on function public.apply_role_markup(numeric, numeric) from public, anon, authenticated;
revoke all on function public.markup_percent_for(uuid) from public, anon, authenticated;
revoke all on function public.selling_prices_for(uuid, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.sell_unit_price(numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Hide catalog prices from customers
-- ---------------------------------------------------------------------------

drop policy if exists "products_select_active_for_users" on public.products;
create policy "products_select_admin"
  on public.products for select
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 5. Customer-facing RPCs (selling prices only, never markup)
-- ---------------------------------------------------------------------------

create or replace function public.list_shop_products()
returns setof public.products
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
    p.id,
    p.code,
    p.name,
    p.description,
    p.category,
    s.price_usd,
    p.currency,
    p.is_active,
    p.last_price_change_at,
    p.created_at,
    p.updated_at,
    p.dosage_vial,
    s.bulk_price_usd,
    s.bulk_price_min_quantity
  from public.products p
  cross join lateral public.selling_prices_for(_uid, p.price_usd, p.bulk_price_usd, p.bulk_price_min_quantity) s
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
  _row public.products;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select
    p.id, p.code, p.name, p.description, p.category,
    s.price_usd, p.currency, p.is_active, p.last_price_change_at,
    p.created_at, p.updated_at, p.dosage_vial,
    s.bulk_price_usd, s.bulk_price_min_quantity
  into _row
  from public.products p
  cross join lateral public.selling_prices_for(_uid, p.price_usd, p.bulk_price_usd, p.bulk_price_min_quantity) s
  where p.code = upper(trim(_code));

  return _row;
end;
$$;

create or replace function public.get_my_customer_role_name()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _name text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select r.name into _name
  from public.user_customer_roles u
  join public.customer_roles r on r.id = u.role_id
  where u.user_id = auth.uid();

  if _name is null then
    select name into _name from public.customer_roles where is_default limit 1;
  end if;
  return _name;
end;
$$;

revoke all on function public.list_shop_products() from public;
grant execute on function public.list_shop_products() to authenticated;
revoke all on function public.get_shop_product_by_code(text) from public;
grant execute on function public.get_shop_product_by_code(text) to authenticated;
revoke all on function public.get_my_customer_role_name() from public;
grant execute on function public.get_my_customer_role_name() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cart: rewrite snapshots to current selling prices (role-aware)
-- ---------------------------------------------------------------------------

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
    select * into _product from public.products where id = _item.product_id;
    if _product.id is null or not _product.is_active then
      continue;
    end if;

    _normal := public.apply_role_markup(_product.price_usd, _markup);
    if _product.bulk_price_usd is not null and _product.bulk_price_min_quantity is not null and _product.bulk_price_min_quantity > 0 then
      _bulk := public.apply_role_markup(_product.bulk_price_usd, _markup);
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

revoke all on function public.sync_cart_selling_prices(uuid) from public;
grant execute on function public.sync_cart_selling_prices(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. create_order: live catalog + current role markup, ignore client prices
-- ---------------------------------------------------------------------------

create or replace function public.create_order(_cart_id uuid, _note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart record;
  _item record;
  _product record;
  _order_id uuid;
  _order_number text;
  _position int := 0;
  _line_total numeric(12, 2);
  _total_usd numeric(14, 2) := 0;
  _total_eur numeric(14, 2) := 0;
  _eur_complete boolean := true;
  _line_count int;
  _rate numeric(12, 6);
  _markup numeric;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _eur numeric;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _cart
  from public.carts
  where id = _cart_id and user_id = auth.uid() and deleted_at is null
  for update;

  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _cart.status not in ('draft', 'ready') then
    raise exception 'Dieser Warenkorb wurde bereits bestellt oder ist archiviert.' using errcode = 'P0001';
  end if;

  select count(*) into _line_count
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = _cart_id
    and p.is_active
    and ci.quantity > 0;

  if _line_count = 0 then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  _markup := public.markup_percent_for(auth.uid());

  insert into public.orders (user_id, cart_id, status, note, total_usd, total_eur, exchange_rate, submitted_at)
  values (auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), 0, null, null, now())
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*
    from public.cart_items ci
    where ci.cart_id = _cart_id and ci.quantity > 0
    order by ci.position
  loop
    select * into _product from public.products where id = _item.product_id and is_active;
    if not found then
      continue;
    end if;

    _sell := public.sell_unit_price(
      _product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity,
      _item.quantity, _markup
    );
    _normal := public.apply_role_markup(_product.price_usd, _markup);
    if _product.bulk_price_usd is not null and _product.bulk_price_min_quantity is not null and _product.bulk_price_min_quantity > 0 then
      _bulk := public.apply_role_markup(_product.bulk_price_usd, _markup);
      _tier := case when _item.quantity >= _product.bulk_price_min_quantity then 'bulk' else 'normal' end;
    else
      _bulk := null;
      _tier := 'normal';
    end if;

    _line_total := round((_item.quantity * _sell)::numeric, 2);
    _total_usd := _total_usd + _line_total;

    _rate := _item.exchange_rate_snapshot;
    if _rate is not null and _rate > 0 then
      _eur := round((_line_total * _rate)::numeric, 2);
      _total_eur := _total_eur + _eur;
    else
      _eur := null;
      _eur_complete := false;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _product.id,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, _product.bulk_price_min_quantity,
      _tier, _sell, _item.quantity, _line_total,
      _rate, _eur
    );

    _position := _position + 1;
  end loop;

  update public.orders
  set total_usd = _total_usd,
      total_eur = case when _eur_complete then _total_eur else null end,
      exchange_rate = _rate
  where id = _order_id;

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object('orderNumber', _order_number, 'totalUsd', _total_usd, 'itemCount', _line_count)
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Admin RPCs for roles (never trust client markup writes without admin)
-- ---------------------------------------------------------------------------

create or replace function public.admin_upsert_customer_role(
  _id uuid,
  _name text,
  _markup_percent numeric,
  _is_active boolean
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
  if _markup_percent is null or _markup_percent < 0 or _markup_percent > 1000 then
    raise exception 'Ungültiger Aufschlag.' using errcode = '22023';
  end if;

  if _id is null then
    insert into public.customer_roles (name, markup_percent, is_active)
    values (_name, _markup_percent, coalesce(_is_active, true))
    returning * into _row;
  else
    update public.customer_roles
    set name = _name, markup_percent = _markup_percent, is_active = coalesce(_is_active, is_active)
    where id = _id
    returning * into _row;
    if not found then
      raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
    end if;
  end if;

  perform public.log_audit(auth.uid(), 'customer_role.upsert', 'customer_role', _row.id, null,
    jsonb_build_object('name', _row.name, 'markupPercent', _row.markup_percent, 'isActive', _row.is_active));
  return _row;
end;
$$;

create or replace function public.admin_delete_customer_role(_id uuid)
returns void
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

  select * into _row from public.customer_roles where id = _id;
  if not found then
    raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if _row.is_default then
    raise exception 'Die Standardrolle kann nicht gelöscht werden.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.user_customer_roles where role_id = _id) then
    raise exception 'Rolle ist noch Benutzern zugewiesen.' using errcode = 'P0001';
  end if;

  delete from public.customer_roles where id = _id;
  perform public.log_audit(auth.uid(), 'customer_role.delete', 'customer_role', _id,
    jsonb_build_object('name', _row.name), null);
end;
$$;

create or replace function public.admin_assign_customer_role(_user_id uuid, _role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Rollen zuweisen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customer_roles where id = _role_id) then
    raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from auth.users where id = _user_id) then
    raise exception 'Benutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.user_customer_roles (user_id, role_id, updated_by, updated_at)
  values (_user_id, _role_id, auth.uid(), now())
  on conflict (user_id) do update
    set role_id = excluded.role_id, updated_by = excluded.updated_by, updated_at = now();

  perform public.log_audit(auth.uid(), 'customer_role.assign', 'user', _user_id, null,
    jsonb_build_object('roleId', _role_id));
end;
$$;

revoke all on function public.admin_upsert_customer_role(uuid, text, numeric, boolean) from public;
grant execute on function public.admin_upsert_customer_role(uuid, text, numeric, boolean) to authenticated;
revoke all on function public.admin_delete_customer_role(uuid) from public;
grant execute on function public.admin_delete_customer_role(uuid) to authenticated;
revoke all on function public.admin_assign_customer_role(uuid, uuid) from public;
grant execute on function public.admin_assign_customer_role(uuid, uuid) to authenticated;

-- Writes go through the admin RPCs (DEFINER). Clients keep SELECT so admins
-- can list roles; RLS still hides rows from non-admins.
revoke insert, update, delete on public.customer_roles from authenticated;
grant select on public.customer_roles to authenticated;

revoke all on function public.create_order(uuid, text) from public;
grant execute on function public.create_order(uuid, text) to authenticated;

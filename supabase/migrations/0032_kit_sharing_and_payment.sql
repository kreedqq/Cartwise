-- 0032_kit_sharing_and_payment.sql
-- Server-side kit sharing between authenticated members + structured payment_method.
-- ---------------------------------------------------------------------------
-- 1. orders.payment_method
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('crypto', 'bank_transfer', 'paypal'));

comment on column public.orders.payment_method is
  'Customer-selected payment method at checkout. Required for new orders via create_order().';

-- ---------------------------------------------------------------------------
-- 2. kit_shares + kit_share_participants
-- ---------------------------------------------------------------------------

create table public.kit_shares (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  creator_user_id uuid not null references auth.users (id) on delete cascade,
  kit_size_vials integer not null
    check (kit_size_vials >= 2 and kit_size_vials <= 100),
  status text not null default 'open'
    check (status in ('open', 'full', 'cancelled', 'ordered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kit_shares_product_id_idx on public.kit_shares (product_id);
create index kit_shares_creator_user_id_idx on public.kit_shares (creator_user_id);
create index kit_shares_status_idx on public.kit_shares (status);

create trigger kit_shares_set_updated_at
  before update on public.kit_shares
  for each row
  execute function public.set_updated_at();

comment on table public.kit_shares is
  'Shared multi-vial kit allocation for a single catalog product. Mutations via RPC only.';

create table public.kit_share_participants (
  id uuid primary key default gen_random_uuid(),
  kit_share_id uuid not null references public.kit_shares (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantity integer not null check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kit_share_id, user_id)
);

create index kit_share_participants_kit_share_id_idx
  on public.kit_share_participants (kit_share_id);

create index kit_share_participants_user_id_idx
  on public.kit_share_participants (user_id);

create trigger kit_share_participants_set_updated_at
  before update on public.kit_share_participants
  for each row
  execute function public.set_updated_at();

comment on table public.kit_share_participants is
  'Per-user vial allocation inside a kit share. No price columns — prices computed per viewer in RPCs.';

alter table public.cart_items
  add column if not exists kit_share_id uuid references public.kit_shares (id) on delete set null;

create index cart_items_kit_share_id_idx on public.cart_items (kit_share_id)
  where kit_share_id is not null;

-- ---------------------------------------------------------------------------
-- 3. RLS — read-only direct access; writes via SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------

alter table public.kit_shares enable row level security;
alter table public.kit_share_participants enable row level security;

create policy "kit_shares_select_participant"
  on public.kit_shares
  for select
  to authenticated
  using (
    creator_user_id = auth.uid()
    or exists (
      select 1
      from public.kit_share_participants p
      where p.kit_share_id = kit_shares.id
        and p.user_id = auth.uid()
    )
  );

create policy "kit_share_participants_select_same_kit"
  on public.kit_share_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.kit_share_participants mine
      where mine.kit_share_id = kit_share_participants.kit_share_id
        and mine.user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.kit_shares from authenticated;
revoke insert, update, delete on public.kit_share_participants from authenticated;
grant select on public.kit_shares to authenticated;
grant select on public.kit_share_participants to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Internal helpers (not granted to clients)
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_allocated_total(_kit_share_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.kit_share_participants
  where kit_share_id = _kit_share_id;
$$;

revoke all on function public.kit_share_allocated_total(uuid) from public;

create or replace function public.kit_share_participant_price_usd(
  _kit_share_id uuid,
  _user_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _product public.products;
  _qty integer;
  _markup numeric;
  _catalog_share numeric;
begin
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return null;
  end if;

  select quantity into _qty
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _user_id;

  if _qty is null then
    return null;
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    return null;
  end if;

  _markup := public.markup_percent_for(_user_id);
  _catalog_share := (_product.price_usd / _kit.kit_size_vials) * _qty;
  return round(public.apply_role_markup(_catalog_share, _markup)::numeric, 2);
end;
$$;

revoke all on function public.kit_share_participant_price_usd(uuid, uuid) from public;

create or replace function public.kit_share_refresh_status_locked(_kit_share_id uuid)
returns public.kit_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _allocated integer;
begin
  select * into _kit
  from public.kit_shares
  where id = _kit_share_id
  for update;

  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  if _allocated > _kit.kit_size_vials then
    raise exception 'Die gewünschte Menge überschreitet die verfügbare Kitmenge.' using errcode = 'P0001';
  end if;

  update public.kit_shares
  set status = case when _allocated = _kit.kit_size_vials then 'full' else 'open' end,
      updated_at = now()
  where id = _kit_share_id
  returning * into _kit;

  return _kit;
end;
$$;

revoke all on function public.kit_share_refresh_status_locked(uuid) from public;

-- ---------------------------------------------------------------------------
-- 5. list_kit_share_members
-- ---------------------------------------------------------------------------

create or replace function public.list_kit_share_members()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
  order by lower(p.display_name), p.display_name;
$$;

comment on function public.list_kit_share_members() is
  'Eligible kit-share invite targets: display name only, never email. Excludes caller.';

revoke all on function public.list_kit_share_members() from public;
grant execute on function public.list_kit_share_members() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. create_kit_share
-- ---------------------------------------------------------------------------

create or replace function public.create_kit_share(
  _product_id uuid,
  _kit_size_vials integer,
  _my_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _allocated integer;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _kit_size_vials is null or _kit_size_vials < 2 or _kit_size_vials > 100 then
    raise exception 'Ungültige Kitgröße.' using errcode = '22023';
  end if;

  if _my_quantity is null or _my_quantity < 1 or _my_quantity > _kit_size_vials then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _product from public.products where id = _product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.kit_shares (product_id, creator_user_id, kit_size_vials, status)
  values (
    _product_id,
    _uid,
    _kit_size_vials,
    case when _my_quantity = _kit_size_vials then 'full' else 'open' end
  )
  returning * into _kit;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit.id, _uid, _my_quantity);

  _allocated := public.kit_share_allocated_total(_kit.id);

  return jsonb_build_object(
    'id', _kit.id,
    'productId', _product.id,
    'productName', _product.name,
    'productCode', _product.code,
    'kitSizeVials', _kit.kit_size_vials,
    'status', _kit.status,
    'allocatedTotal', _allocated,
    'remainingVials', _kit.kit_size_vials - _allocated,
    'myQuantity', _my_quantity,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit.id, _uid),
    'participants', jsonb_build_array(
      jsonb_build_object('isSelf', true, 'displayName', 'Du', 'quantity', _my_quantity)
    )
  );
end;
$$;

revoke all on function public.create_kit_share(uuid, integer, integer) from public;
grant execute on function public.create_kit_share(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6b. get_my_kit_share — price privacy enforced server-side
-- ---------------------------------------------------------------------------

create or replace function public.get_my_kit_share(_kit_share_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _my_qty integer;
  _allocated integer;
  _participants jsonb;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.kit_share_participants p
    where p.kit_share_id = _kit_share_id and p.user_id = _uid
  ) then
    raise exception 'Keine Berechtigung, dieses Kit anzuzeigen.' using errcode = '42501';
  end if;

  select * into _product from public.products where id = _kit.product_id;

  select quantity into _my_qty
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'isSelf', p.user_id = _uid,
        'displayName', case when p.user_id = _uid then 'Du' else coalesce(pr.display_name, 'Teilnehmer') end,
        'quantity', p.quantity
      )
      order by case when p.user_id = _uid then 0 else 1 end, lower(pr.display_name)
    ),
    '[]'::jsonb
  )
  into _participants
  from public.kit_share_participants p
  left join public.profiles pr on pr.id = p.user_id
  where p.kit_share_id = _kit_share_id;

  return jsonb_build_object(
    'id', _kit.id,
    'productId', _kit.product_id,
    'productName', _product.name,
    'productCode', _product.code,
    'kitSizeVials', _kit.kit_size_vials,
    'status', _kit.status,
    'allocatedTotal', _allocated,
    'remainingVials', _kit.kit_size_vials - _allocated,
    'myQuantity', _my_qty,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit_share_id, _uid),
    'canAddToCart', _kit.status = 'full',
    'participants', _participants
  );
end;
$$;

revoke all on function public.get_my_kit_share(uuid) from public;
grant execute on function public.get_my_kit_share(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. invite_kit_share_participant (creator adds member atomically)
-- ---------------------------------------------------------------------------

create or replace function public.invite_kit_share_participant(
  _kit_share_id uuid,
  _participant_user_id uuid,
  _quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _allocated integer;
  _display_name text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _participant_user_id = _uid then
    raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.creator_user_id <> _uid then
    raise exception 'Nur der Ersteller kann Teilnehmer hinzufügen.' using errcode = '42501';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _participant_user_id
  ) then
    raise exception 'Dieses Mitglied ist bereits Teil des Kits.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = _participant_user_id) then
    raise exception 'Mitglied wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  if _allocated + _quantity > _kit.kit_size_vials then
    raise exception 'Die gewünschte Menge überschreitet die verfügbare Kitmenge.' using errcode = 'P0001';
  end if;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit_share_id, _participant_user_id, _quantity);

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  select display_name into _display_name from public.profiles where id = _participant_user_id;
  _allocated := public.kit_share_allocated_total(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

revoke all on function public.invite_kit_share_participant(uuid, uuid, integer) from public;
grant execute on function public.invite_kit_share_participant(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. join_kit_share (member joins open kit)
-- ---------------------------------------------------------------------------

create or replace function public.join_kit_share(
  _kit_share_id uuid,
  _quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _allocated integer;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered', 'full') then
    raise exception 'Sie können diesem Kit nicht mehr beitreten.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _uid
  ) then
    raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  if _allocated + _quantity > _kit.kit_size_vials then
    raise exception 'Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar.' using errcode = 'P0001';
  end if;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit_share_id, _uid, _quantity);

  perform public.kit_share_refresh_status_locked(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

revoke all on function public.join_kit_share(uuid, integer) from public;
grant execute on function public.join_kit_share(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. update_kit_share_quantity
-- ---------------------------------------------------------------------------

create or replace function public.update_kit_share_quantity(
  _kit_share_id uuid,
  _quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _allocated integer;
  _others integer;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if not found then
    raise exception 'Keine Berechtigung, diese Menge zu ändern.' using errcode = '42501';
  end if;

  _others := public.kit_share_allocated_total(_kit_share_id) - _participant.quantity;
  if _others + _quantity > _kit.kit_size_vials then
    raise exception 'Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar.' using errcode = 'P0001';
  end if;

  update public.kit_share_participants
  set quantity = _quantity, updated_at = now()
  where id = _participant.id;

  perform public.kit_share_refresh_status_locked(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

revoke all on function public.update_kit_share_quantity(uuid, integer) from public;
grant execute on function public.update_kit_share_quantity(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. leave_kit_share / cancel_kit_share
-- ---------------------------------------------------------------------------

create or replace function public.leave_kit_share(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if _kit.creator_user_id = _uid then
    raise exception 'Der Ersteller kann das Kit nicht verlassen. Bitte stornieren.' using errcode = 'P0001';
  end if;

  delete from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  perform public.kit_share_refresh_status_locked(_kit_share_id);
end;
$$;

revoke all on function public.leave_kit_share(uuid) from public;
grant execute on function public.leave_kit_share(uuid) to authenticated;

create or replace function public.cancel_kit_share(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.creator_user_id <> _uid then
    raise exception 'Nur der Ersteller kann das Kit stornieren.' using errcode = '42501';
  end if;

  if _kit.status = 'ordered' then
    raise exception 'Dieses Kit wurde bereits bestellt.' using errcode = 'P0001';
  end if;

  update public.kit_shares
  set status = 'cancelled', updated_at = now()
  where id = _kit_share_id;
end;
$$;

revoke all on function public.cancel_kit_share(uuid) from public;
grant execute on function public.cancel_kit_share(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. add_kit_share_to_cart
-- ---------------------------------------------------------------------------

create or replace function public.add_kit_share_to_cart(_kit_share_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _participant public.kit_share_participants;
  _cart_id uuid;
  _position integer;
  _markup numeric;
  _unit numeric;
  _catalog_vial numeric;
  _rate numeric;
  _line numeric;
  _item_id uuid;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status <> 'full' then
    raise exception 'Das Kit ist noch nicht vollständig verteilt.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if not found then
    raise exception 'Keine Berechtigung für dieses Kit.' using errcode = '42501';
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select id into _cart_id
  from public.carts
  where user_id = _uid and is_active_cart and deleted_at is null and status in ('draft', 'ready')
  limit 1;

  if _cart_id is null then
    insert into public.carts (user_id, name, status, is_active_cart)
    values (_uid, 'Warenkorb', 'draft', true)
    returning id into _cart_id;
  end if;

  select coalesce(max(position), -1) + 1 into _position
  from public.cart_items where cart_id = _cart_id;

  _markup := public.markup_percent_for(_uid);
  _catalog_vial := _product.price_usd / _kit.kit_size_vials;
  _unit := public.apply_role_markup(_catalog_vial, _markup);

  select exchange_rate into _rate
  from public.exchange_rates
  order by fetched_at desc nulls last
  limit 1;

  _line := round((_participant.quantity * _unit)::numeric, 2);

  delete from public.cart_items
  where cart_id = _cart_id and kit_share_id = _kit_share_id and product_id = _product.id;

  insert into public.cart_items (
    cart_id, position, product_id, product_code_input, product_code_snapshot, product_name_snapshot,
    quantity, unit_price_usd_snapshot, normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier, exchange_rate_snapshot, eur_value_snapshot,
    price_snapshot_at, resolution_status, note, kit_share_id
  )
  values (
    _cart_id, _position, _product.id, _product.code, _product.code, _product.name,
    _participant.quantity, _unit, _unit, null, null, 'normal',
    _rate, case when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2) else null end,
    now(), 'resolved',
    format('Gemeinsames %s-Vial-Kit · Meine Menge: %s Vials', _kit.kit_size_vials, _participant.quantity),
    _kit_share_id
  )
  returning id into _item_id;

  return _item_id;
end;
$$;

revoke all on function public.add_kit_share_to_cart(uuid) from public;
grant execute on function public.add_kit_share_to_cart(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. sync_cart_selling_prices — skip kit-share lines
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
    if _item.kit_share_id is not null then
      continue;
    end if;

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

-- ---------------------------------------------------------------------------
-- 14. create_order — require payment_method, mark kit shares ordered
-- ---------------------------------------------------------------------------

drop function if exists public.create_order(uuid, text);

create or replace function public.create_order(
  _cart_id uuid,
  _note text default null,
  _payment_method text default null
)
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
  _kit public.kit_shares;
  _kit_participant record;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _payment_method is null or _payment_method not in ('crypto', 'bank_transfer', 'paypal') then
    raise exception 'Bitte wählen Sie eine Zahlungsmethode aus.' using errcode = 'P0001';
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

  insert into public.orders (
    user_id, cart_id, status, note, payment_method, total_usd, total_eur, exchange_rate, submitted_at
  )
  values (
    auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), _payment_method,
    0, null, null, now()
  )
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

    if _item.kit_share_id is not null then
      select * into _kit from public.kit_shares where id = _item.kit_share_id;
      if not found or _kit.status <> 'full' then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      select * into _kit_participant
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id and user_id = auth.uid();

      if not found or _kit_participant.quantity <> _item.quantity then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      _sell := _item.unit_price_usd_snapshot;
      _normal := _sell;
      _bulk := null;
      _tier := 'normal';
    else
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

  update public.kit_shares ks
  set status = 'ordered', updated_at = now()
  where ks.id in (
    select distinct ci.kit_share_id
    from public.cart_items ci
    where ci.cart_id = _cart_id and ci.kit_share_id is not null
  );

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber', _order_number,
      'totalUsd', _total_usd,
      'itemCount', _line_count,
      'paymentMethod', _payment_method
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

revoke all on function public.create_order(uuid, text, text) from public;
grant execute on function public.create_order(uuid, text, text) to authenticated;

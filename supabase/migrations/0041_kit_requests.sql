-- 0041_kit_requests.sql
-- Open kit marketplace ("Kit Gesuche") on top of existing kit_shares.
-- Invite-based kit sharing is unchanged: is_open_request defaults to false.
-- Pricing, 10-unit rule, cart naming (profiles.username), and cart sync
-- helpers stay the existing kit-share functions. Cart lines for open
-- requests are created only when the kit becomes full.

-- ---------------------------------------------------------------------------
-- 1. Additive columns + status 'expired'
-- ---------------------------------------------------------------------------

alter table public.kit_shares
  add column if not exists is_open_request boolean not null default false;

alter table public.kit_shares
  add column if not exists note text;

alter table public.kit_shares
  add column if not exists expires_at timestamptz;

alter table public.kit_shares
  add column if not exists completed_at timestamptz;

alter table public.kit_shares
  drop constraint if exists kit_shares_status_check;

alter table public.kit_shares
  add constraint kit_shares_status_check
  check (status in ('open', 'full', 'cancelled', 'ordered', 'expired'));

alter table public.kit_shares
  drop constraint if exists kit_shares_note_length_check;

alter table public.kit_shares
  add constraint kit_shares_note_length_check
  check (note is null or char_length(note) <= 280);

comment on column public.kit_shares.is_open_request is
  'True when this kit was posted to the open marketplace (Kit Gesuche). False = invite-only kit share.';

comment on column public.kit_shares.note is
  'Optional public hint on an open kit request. Never contains emails or prices of other users.';

comment on column public.kit_shares.expires_at is
  'Optional deadline. After this instant the request becomes expired and cannot complete or create carts.';

comment on column public.kit_shares.completed_at is
  'Set when an open request first reaches kit_size_vials (status full) and carts are synced.';

create index if not exists kit_shares_open_request_status_created_idx
  on public.kit_shares (status, created_at desc)
  where is_open_request;

create index if not exists kit_shares_open_request_product_idx
  on public.kit_shares (product_id, created_at desc)
  where is_open_request;

create unique index if not exists cart_items_one_kit_share_per_cart
  on public.cart_items (cart_id, kit_share_id)
  where kit_share_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Admin read (existing architecture: admins may SELECT; no new admin UI)
-- ---------------------------------------------------------------------------

drop policy if exists "kit_shares_select_admin" on public.kit_shares;
create policy "kit_shares_select_admin"
  on public.kit_shares
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "kit_share_participants_select_admin" on public.kit_share_participants;
create policy "kit_share_participants_select_admin"
  on public.kit_share_participants
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3. Block invite-path mutations on marketplace kits (leave existing RPCs intact)
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_guard_open_request_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
begin
  if tg_op = 'INSERT' then
    select * into _kit from public.kit_shares where id = new.kit_share_id;
    if found and coalesce(_kit.is_open_request, false) then
      if new.user_id = _kit.creator_user_id then
        return new;
      end if;
      if current_setting('peptix.allow_kit_request_join', true) = '1' then
        return new;
      end if;
      raise exception 'Kit-Gesuche können keine Einladungen verwenden.' using errcode = 'P0001';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    select * into _kit from public.kit_shares where id = new.kit_share_id;
    if found and coalesce(_kit.is_open_request, false)
       and new.quantity is distinct from old.quantity
       and current_setting('peptix.allow_kit_request_join', true) <> '1' then
      raise exception 'Die Menge eines Kit-Gesuchs kann nicht über die Einladungsfunktion geändert werden.'
        using errcode = 'P0001';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select * into _kit from public.kit_shares where id = old.kit_share_id;
    if found and coalesce(_kit.is_open_request, false) and old.user_id <> auth.uid() then
      raise exception 'Teilnehmer eines Kit-Gesuchs können nicht über die Einladungsfunktion entfernt werden.'
        using errcode = 'P0001';
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists kit_share_guard_open_request_participant on public.kit_share_participants;
create trigger kit_share_guard_open_request_participant
  before insert or update or delete on public.kit_share_participants
  for each row
  execute function public.kit_share_guard_open_request_participant();

revoke all on function public.kit_share_guard_open_request_participant() from public;

-- ---------------------------------------------------------------------------
-- 4. Refresh / leave / cancel: marketplace completed kits must not reopen
-- ---------------------------------------------------------------------------

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

  if _kit.status in ('cancelled', 'ordered', 'expired') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  -- Completed marketplace kits must not return to 'open' if allocation later drops.
  if coalesce(_kit.is_open_request, false) and _kit.status = 'full' then
    return _kit;
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  if _allocated > _kit.kit_size_vials then
    raise exception 'Die Kit Verteilung ist ungültig. Die Gesamtmenge überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  update public.kit_shares
  set status = case
        when _allocated = _kit.kit_size_vials
         and mod(_allocated, 10) = 0
        then 'full'
        else 'open'
      end,
      updated_at = now()
  where id = _kit_share_id
  returning * into _kit;

  return _kit;
end;
$$;

create or replace function public.leave_kit_share(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _participant public.kit_share_participants;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered', 'expired') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if coalesce(_kit.is_open_request, false) and _kit.status = 'full' then
    raise exception 'Ein abgeschlossenes Kit-Gesuch kann nicht mehr verlassen werden.' using errcode = 'P0001';
  end if;

  if _kit.creator_user_id = _uid then
    raise exception 'Der Ersteller kann das Kit nicht verlassen. Bitte stornieren.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if found and _participant.ordered_at is not null then
    raise exception 'Du hast diesen Kit-Anteil bereits bestellt und kannst das Kit nicht mehr verlassen.' using errcode = 'P0001';
  end if;

  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and c.user_id = _uid
    and c.deleted_at is null
    and ci.kit_share_id = _kit_share_id;

  delete from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  perform public.kit_share_refresh_status_locked(_kit_share_id);
end;
$$;

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

  if coalesce(_kit.is_open_request, false) and _kit.status in ('full', 'expired') then
    raise exception 'Ein abgeschlossenes oder abgelaufenes Kit-Gesuch kann nicht mehr storniert werden.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and ordered_at is not null
  ) then
    raise exception 'Mindestens ein Teilnehmer hat bereits bestellt; dieses Kit kann nicht mehr storniert werden.' using errcode = 'P0001';
  end if;

  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and ci.kit_share_id = _kit_share_id
    and c.status <> 'ordered';

  update public.kit_shares
  set status = 'cancelled', updated_at = now()
  where id = _kit_share_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Internal helpers (not granted to clients)
-- ---------------------------------------------------------------------------

create or replace function public.kit_request_shop_category(_product public.products)
returns text
language sql
immutable
as $$
  select case
    when upper(trim(coalesce(_product.code, ''))) in ('AA10', 'BA03', 'BA10') then 'reconstitution-water'
    when lower(trim(coalesce(_product.name, ''))) in ('bac water', 'aa water') then 'reconstitution-water'
    when lower(replace(coalesce(_product.category, ''), '_', '-')) like '%reconstitution%' then 'reconstitution-water'
    when lower(coalesce(_product.category, '')) like '%oral%' then 'orals'
    when lower(coalesce(_product.category, '')) like '%inject%'
      or lower(coalesce(_product.category, '')) like '%oil%' then 'injectable-oils'
    else 'peptides'
  end;
$$;

revoke all on function public.kit_request_shop_category(public.products) from public;

create or replace function public.kit_request_expire_overdue()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.kit_shares
  set status = 'expired', updated_at = now()
  where is_open_request
    and status = 'open'
    and expires_at is not null
    and expires_at <= now();
end;
$$;

revoke all on function public.kit_request_expire_overdue() from public;

create or replace function public.kit_request_viewer_unit_usd(
  _product public.products,
  _kit_size integer,
  _allocated integer,
  _uid uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _catalog numeric;
begin
  if _product.id is null or not _product.is_active then
    return null;
  end if;
  _catalog := public.kit_share_catalog_unit_usd(_product, _kit_size, greatest(_allocated, 0));
  return round(public.apply_role_markup(_catalog, public.markup_percent_for(_uid))::numeric, 2);
end;
$$;

revoke all on function public.kit_request_viewer_unit_usd(public.products, integer, integer, uuid) from public;

create or replace function public.kit_request_card_payload(
  _kit public.kit_shares,
  _product public.products,
  _uid uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _allocated integer;
  _creator_qty integer;
  _my_qty integer := 0;
  _creator_username text;
  _unit numeric;
  _my_price numeric;
begin
  _allocated := public.kit_share_allocated_total(_kit.id);

  select quantity into _creator_qty
  from public.kit_share_participants
  where kit_share_id = _kit.id and user_id = _kit.creator_user_id;

  select quantity into _my_qty
  from public.kit_share_participants
  where kit_share_id = _kit.id and user_id = _uid;

  select username into _creator_username
  from public.profiles
  where id = _kit.creator_user_id;

  _unit := public.kit_request_viewer_unit_usd(_product, _kit.kit_size_vials, _allocated, _uid);

  if coalesce(_my_qty, 0) > 0 then
    _my_price := public.kit_share_participant_price_usd(_kit.id, _uid);
  else
    _my_price := null;
  end if;

  return jsonb_build_object(
    'id', _kit.id,
    'productId', _kit.product_id,
    'productName', _product.name,
    'productCode', _product.code,
    'variantLabel', coalesce(nullif(trim(_product.dosage_vial), ''), _product.code),
    'category', public.kit_request_shop_category(_product),
    'creatorUsername', coalesce(nullif(trim(_creator_username), ''), 'Teilnehmer'),
    'kitSizeVials', _kit.kit_size_vials,
    'allocatedTotal', _allocated,
    'remainingVials', _kit.kit_size_vials - _allocated,
    'creatorQuantity', coalesce(_creator_qty, 0),
    'myQuantity', coalesce(_my_qty, 0),
    'myUnitPriceUsd', _unit,
    'myPriceUsd', _my_price,
    'isCreator', _kit.creator_user_id = _uid,
    'isParticipant', coalesce(_my_qty, 0) > 0,
    'status', _kit.status,
    'createdAt', _kit.created_at,
    'expiresAt', _kit.expires_at,
    'completedAt', _kit.completed_at,
    'note', _kit.note
  );
end;
$$;

revoke all on function public.kit_request_card_payload(public.kit_shares, public.products, uuid) from public;

-- ---------------------------------------------------------------------------
-- 6. create_kit_request
-- ---------------------------------------------------------------------------

create or replace function public.create_kit_request(
  _product_id uuid,
  _kit_size_vials integer,
  _my_quantity integer,
  _note text default null,
  _expires_at timestamptz default null
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
  _username text;
  _clean_note text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select username into _username from public.profiles where id = _uid;
  if _username is null or trim(_username) = '' then
    raise exception 'Bitte setze zuerst einen Benutzernamen.' using errcode = 'P0001';
  end if;

  if _kit_size_vials is null
     or _kit_size_vials < 10
     or _kit_size_vials > 100
     or mod(_kit_size_vials, 10) <> 0 then
    raise exception 'Ungültige Kitgröße. Die Größe muss ein Vielfaches von 10 sein.' using errcode = '22023';
  end if;

  if _my_quantity is null or _my_quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  if _my_quantity >= _kit_size_vials then
    raise exception 'Der Ersteller muss mindestens 1 Vial offen lassen, damit andere beitreten können.' using errcode = '22023';
  end if;

  if _expires_at is not null and _expires_at <= now() then
    raise exception 'Das Ablaufdatum muss in der Zukunft liegen.' using errcode = '22023';
  end if;

  _clean_note := nullif(trim(coalesce(_note, '')), '');
  if _clean_note is not null and char_length(_clean_note) > 280 then
    raise exception 'Der Hinweis darf höchstens 280 Zeichen lang sein.' using errcode = '22023';
  end if;

  select * into _product from public.products where id = _product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.kit_shares (
    product_id,
    creator_user_id,
    kit_size_vials,
    status,
    is_open_request,
    note,
    expires_at
  )
  values (
    _product_id,
    _uid,
    _kit_size_vials,
    'open',
    true,
    _clean_note,
    _expires_at
  )
  returning * into _kit;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit.id, _uid, _my_quantity);

  perform public.log_audit(
    _uid,
    'kit_request_created',
    'kit_share',
    _kit.id,
    null,
    jsonb_build_object(
      'productId', _product.id,
      'kitSizeVials', _kit.kit_size_vials,
      'creatorQuantity', _my_quantity
    )
  );

  return public.kit_request_card_payload(_kit, _product, _uid);
end;
$$;

revoke all on function public.create_kit_request(uuid, integer, integer, text, timestamptz) from public;
grant execute on function public.create_kit_request(uuid, integer, integer, text, timestamptz) to authenticated;

comment on function public.create_kit_request(uuid, integer, integer, text, timestamptz) is
  'Create an open kit request. Creator quantity must leave at least 1 unit free. No cart sync until the kit is full.';

-- ---------------------------------------------------------------------------
-- 7. preview_kit_request_join (read-only; join RPC remains authoritative)
-- ---------------------------------------------------------------------------

create or replace function public.preview_kit_request_join(
  _kit_share_id uuid,
  _quantity integer
)
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
  _allocated integer;
  _remaining integer;
  _markup numeric;
  _base numeric;
  _my_price numeric;
  _unit numeric;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.expires_at is not null and _kit.expires_at <= now() then
    raise exception 'Dieses Kit-Gesuch ist abgelaufen.' using errcode = 'P0001';
  end if;

  if _kit.status <> 'open' then
    raise exception 'Dieses Kit-Gesuch nimmt keine weiteren Teilnehmer auf.' using errcode = 'P0001';
  end if;

  if _kit.creator_user_id = _uid then
    raise exception 'Du kannst deinem eigenen Gesuch nicht beitreten.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _uid
  ) then
    raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _remaining := _kit.kit_size_vials - _allocated;
  if _quantity > _remaining then
    raise exception 'Nicht genügend Vials verfügbar.' using errcode = 'P0001';
  end if;

  _markup := public.markup_percent_for(_uid);
  _base := public.kit_share_participant_base_usd(
    _product,
    _kit.kit_size_vials,
    _allocated + _quantity,
    _quantity
  );
  _my_price := round(public.apply_role_markup(_base, _markup)::numeric, 2);
  _unit := public.kit_request_viewer_unit_usd(_product, _kit.kit_size_vials, _allocated + _quantity, _uid);

  return jsonb_build_object(
    'kitRequestId', _kit.id,
    'myQuantity', _quantity,
    'remainingQuantity', _remaining,
    'remainingAfterJoin', _remaining - _quantity,
    'status', _kit.status,
    'myPriceUsd', _my_price,
    'myUnitPriceUsd', _unit
  );
end;
$$;

revoke all on function public.preview_kit_request_join(uuid, integer) from public;
grant execute on function public.preview_kit_request_join(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. join_kit_request — row lock, remaining check, cart sync only when full
-- ---------------------------------------------------------------------------

create or replace function public.join_kit_request(
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
  _product public.products;
  _allocated integer;
  _remaining integer;
  _cart_synced boolean := false;
  _username text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select username into _username from public.profiles where id = _uid;
  if _username is null or trim(_username) = '' then
    raise exception 'Bitte setze zuerst einen Benutzernamen.' using errcode = 'P0001';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit
  from public.kit_shares
  where id = _kit_share_id
  for update;

  if not found then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.expires_at is not null and _kit.expires_at <= now() then
    update public.kit_shares
    set status = 'expired', updated_at = now()
    where id = _kit.id and status = 'open';
    raise exception 'Dieses Kit-Gesuch ist abgelaufen.' using errcode = 'P0001';
  end if;

  if _kit.status = 'full' then
    raise exception 'Dieses Kit ist bereits vollständig.' using errcode = 'P0001';
  end if;

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit-Gesuch wurde storniert.' using errcode = 'P0001';
  end if;

  if _kit.status = 'expired' then
    raise exception 'Dieses Kit-Gesuch ist abgelaufen.' using errcode = 'P0001';
  end if;

  if _kit.status <> 'open' then
    raise exception 'Dieses Kit-Gesuch nimmt keine weiteren Teilnehmer auf.' using errcode = 'P0001';
  end if;

  if _kit.creator_user_id = _uid then
    raise exception 'Du kannst deinem eigenen Gesuch nicht beitreten.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _uid
  ) then
    raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _remaining := _kit.kit_size_vials - _allocated;

  if _quantity > _remaining then
    raise exception 'Nicht genügend Vials verfügbar.' using errcode = 'P0001';
  end if;

  perform set_config('peptix.allow_kit_request_join', '1', true);

  begin
    insert into public.kit_share_participants (kit_share_id, user_id, quantity)
    values (_kit_share_id, _uid, _quantity);
  exception
    when unique_violation then
      raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end;

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  if _allocated = _kit.kit_size_vials then
    select * into _product from public.products where id = _kit.product_id and is_active;
    if not found then
      raise exception 'Produkt ist nicht mehr verfügbar. Das Kit kann nicht abgeschlossen werden.' using errcode = 'P0001';
    end if;

    _kit := public.kit_share_refresh_status_locked(_kit_share_id);
    perform public.kit_share_sync_all_participant_carts(_kit_share_id);

    update public.kit_shares
    set completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = _kit_share_id
    returning * into _kit;

    _cart_synced := true;

    perform public.log_audit(
      _uid,
      'kit_request_completed',
      'kit_share',
      _kit.id,
      null,
      jsonb_build_object('allocatedTotal', _allocated)
    );
  else
    _kit := public.kit_share_refresh_status_locked(_kit_share_id);
  end if;

  perform public.log_audit(
    _uid,
    'kit_request_joined',
    'kit_share',
    _kit.id,
    null,
    jsonb_build_object('myQuantity', _quantity, 'status', _kit.status)
  );

  return jsonb_build_object(
    'success', true,
    'kitRequestId', _kit.id,
    'myQuantity', _quantity,
    'remainingQuantity', _kit.kit_size_vials - _allocated,
    'status', _kit.status,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit.id, _uid),
    'myUnitPriceUsd', public.kit_request_viewer_unit_usd(_product, _kit.kit_size_vials, _allocated, _uid),
    'cartSynced', _cart_synced
  );
end;
$$;

revoke all on function public.join_kit_request(uuid, integer) from public;
grant execute on function public.join_kit_request(uuid, integer) to authenticated;

comment on function public.join_kit_request(uuid, integer) is
  'Atomically join an open kit request. Locks the kit row. Syncs carts only when the kit becomes full.';

-- ---------------------------------------------------------------------------
-- 9. leave / cancel / retry cart sync
-- ---------------------------------------------------------------------------

create or replace function public.leave_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status <> 'open' then
    raise exception 'Die Teilnahme kann nur bei einem offenen Gesuch storniert werden.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _uid
  ) then
    raise exception 'Keine Berechtigung, diese Teilnahme zu stornieren.' using errcode = '42501';
  end if;

  perform public.leave_kit_share(_kit_share_id);

  select * into _kit from public.kit_shares where id = _kit_share_id;
  select * into _product from public.products where id = _kit.product_id;

  perform public.log_audit(
    _uid,
    'kit_request_left',
    'kit_share',
    _kit.id,
    null,
    jsonb_build_object('status', _kit.status)
  );

  return public.kit_request_card_payload(_kit, _product, _uid);
end;
$$;

revoke all on function public.leave_kit_request(uuid) from public;
grant execute on function public.leave_kit_request(uuid) to authenticated;

create or replace function public.cancel_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status <> 'open' then
    raise exception 'Nur ein offenes Kit-Gesuch kann storniert werden.' using errcode = 'P0001';
  end if;

  perform public.cancel_kit_share(_kit_share_id);

  select * into _kit from public.kit_shares where id = _kit_share_id;
  select * into _product from public.products where id = _kit.product_id;

  perform public.log_audit(
    _uid,
    'kit_request_cancelled',
    'kit_share',
    _kit.id,
    null,
    jsonb_build_object('status', 'cancelled')
  );

  return public.kit_request_card_payload(_kit, _product, _uid);
end;
$$;

revoke all on function public.cancel_kit_request(uuid) from public;
grant execute on function public.cancel_kit_request(uuid) to authenticated;

create or replace function public.sync_completed_kit_request_carts(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _uid
  ) then
    raise exception 'Keine Berechtigung für dieses Kit-Gesuch.' using errcode = '42501';
  end if;

  if _kit.status <> 'full' then
    raise exception 'Warenkörbe werden erst erzeugt, wenn das Kit vollständig ist.' using errcode = 'P0001';
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt ist nicht mehr verfügbar. Der Warenkorb kann nicht synchronisiert werden.' using errcode = 'P0001';
  end if;

  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return jsonb_build_object(
    'success', true,
    'kitRequestId', _kit.id,
    'status', _kit.status,
    'cartSynced', true,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit.id, _uid)
  );
end;
$$;

revoke all on function public.sync_completed_kit_request_carts(uuid) from public;
grant execute on function public.sync_completed_kit_request_carts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Reads: list / mine / detail
-- ---------------------------------------------------------------------------

drop function if exists public.list_open_kit_requests(text, text, uuid, text, integer, text, integer, integer);

create or replace function public.list_open_kit_requests(
  _search text default null,
  _category text default null,
  _product_id uuid default null,
  _product_name text default null,
  _variant text default null,
  _min_remaining integer default null,
  _sort text default 'newest',
  _page integer default 1,
  _page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _term text;
  _page_n integer;
  _size integer;
  _offset integer;
  _total integer;
  _items jsonb;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.kit_request_expire_overdue();

  _term := nullif(trim(coalesce(_search, '')), '');
  _page_n := greatest(coalesce(_page, 1), 1);
  _size := least(greatest(coalesce(_page_size, 20), 1), 50);
  _offset := (_page_n - 1) * _size;

  if _sort is null or _sort not in ('newest', 'fewest_remaining', 'most_remaining') then
    _sort := 'newest';
  end if;

  select count(*)::integer
  into _total
  from public.kit_shares k
  join public.products p on p.id = k.product_id
  left join (
    select kit_share_id, sum(quantity)::integer as allocated
    from public.kit_share_participants
    group by kit_share_id
  ) a on a.kit_share_id = k.id
  where k.is_open_request
    and k.status = 'open'
    and p.is_active
    and (_product_id is null or k.product_id = _product_id)
    and (_product_name is null or lower(p.name) = lower(_product_name))
    and (_category is null or public.kit_request_shop_category(p) = _category)
    and (
      _variant is null
      or lower(coalesce(p.dosage_vial, '')) = lower(_variant)
    )
    and (
      _min_remaining is null
      or (k.kit_size_vials - coalesce(a.allocated, 0)) >= _min_remaining
    )
    and (
      _term is null
      or p.name ilike '%' || _term || '%'
      or p.code ilike '%' || _term || '%'
      or coalesce(p.dosage_vial, '') ilike '%' || _term || '%'
      or exists (
        select 1 from public.profiles pr
        where pr.id = k.creator_user_id
          and pr.username ilike '%' || _term || '%'
      )
    );

  select coalesce(jsonb_agg(q.card order by q.ordinality), '[]'::jsonb)
  into _items
  from (
    select
      public.kit_request_card_payload(k, p, _uid) as card,
      row_number() over (
        order by
          case when _sort = 'fewest_remaining' then (k.kit_size_vials - coalesce(a.allocated, 0)) end asc nulls last,
          case when _sort = 'most_remaining' then (k.kit_size_vials - coalesce(a.allocated, 0)) end desc nulls last,
          k.created_at desc
      ) as ordinality
    from public.kit_shares k
    join public.products p on p.id = k.product_id
    left join (
      select kit_share_id, sum(quantity)::integer as allocated
      from public.kit_share_participants
      group by kit_share_id
    ) a on a.kit_share_id = k.id
    where k.is_open_request
      and k.status = 'open'
      and p.is_active
      and (_product_id is null or k.product_id = _product_id)
    and (_product_name is null or lower(p.name) = lower(_product_name))
      and (_category is null or public.kit_request_shop_category(p) = _category)
      and (
        _variant is null
        or lower(coalesce(p.dosage_vial, '')) = lower(_variant)
      )
      and (
        _min_remaining is null
        or (k.kit_size_vials - coalesce(a.allocated, 0)) >= _min_remaining
      )
      and (
        _term is null
        or p.name ilike '%' || _term || '%'
        or p.code ilike '%' || _term || '%'
        or coalesce(p.dosage_vial, '') ilike '%' || _term || '%'
        or exists (
          select 1 from public.profiles pr
          where pr.id = k.creator_user_id
            and pr.username ilike '%' || _term || '%'
        )
      )
  ) q
  where q.ordinality > _offset
    and q.ordinality <= (_offset + _size);

  return jsonb_build_object(
    'items', coalesce(_items, '[]'::jsonb),
    'total', coalesce(_total, 0),
    'page', _page_n,
    'pageSize', _size
  );
end;
$$;

revoke all on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer) from public;
grant execute on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer) to authenticated;

create or replace function public.list_my_kit_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _items jsonb;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.kit_request_expire_overdue();

  select coalesce(
    jsonb_agg(public.kit_request_card_payload(k, p, _uid) order by k.created_at desc),
    '[]'::jsonb
  )
  into _items
  from public.kit_shares k
  join public.products p on p.id = k.product_id
  where k.is_open_request
    and k.creator_user_id = _uid;

  return jsonb_build_object('items', coalesce(_items, '[]'::jsonb));
end;
$$;

revoke all on function public.list_my_kit_requests() from public;
grant execute on function public.list_my_kit_requests() to authenticated;

create or replace function public.list_my_kit_request_participations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _items jsonb;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.kit_request_expire_overdue();

  select coalesce(
    jsonb_agg(public.kit_request_card_payload(k, p, _uid) order by part.created_at desc),
    '[]'::jsonb
  )
  into _items
  from public.kit_share_participants part
  join public.kit_shares k on k.id = part.kit_share_id
  join public.products p on p.id = k.product_id
  where k.is_open_request
    and part.user_id = _uid
    and k.creator_user_id <> _uid;

  return jsonb_build_object('items', coalesce(_items, '[]'::jsonb));
end;
$$;

revoke all on function public.list_my_kit_request_participations() from public;
grant execute on function public.list_my_kit_request_participations() to authenticated;

create or replace function public.get_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _card jsonb;
  _participants jsonb := '[]'::jsonb;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.kit_request_expire_overdue();

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select * into _product from public.products where id = _kit.product_id;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _card := public.kit_request_card_payload(_kit, _product, _uid);

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id and user_id = _uid
  ) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'isSelf', p.user_id = _uid,
          'username', case
            when p.user_id = _uid then coalesce(pr.username, 'Du')
            else coalesce(pr.username, 'Teilnehmer')
          end,
          'quantity', p.quantity
        )
        order by case when p.user_id = _uid then 0 else 1 end, lower(coalesce(pr.username, ''))
      ),
      '[]'::jsonb
    )
    into _participants
    from public.kit_share_participants p
    left join public.profiles pr on pr.id = p.user_id
    where p.kit_share_id = _kit.id;
  end if;

  return _card || jsonb_build_object('participants', _participants);
end;
$$;

revoke all on function public.get_kit_request(uuid) from public;
grant execute on function public.get_kit_request(uuid) to authenticated;

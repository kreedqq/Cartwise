-- 0038_username_and_kit_participant_removal.sql
-- Adds a unique, validated, server-authoritative username shown during kit
-- sharing (never the real name / display_name, never the email, never the
-- user id). Also adds the missing creator-only "remove participant" RPC.
--
-- Non-destructive / additive only:
--   * `username` is nullable so existing users are never broken.
--   * No existing column, table, or row is dropped or renamed.
--   * `display_name` is untouched and keeps working everywhere it is used
--     today (admin user list, profile page).

-- ---------------------------------------------------------------------------
-- 1. profiles.username — unique, validated, optional (transition-safe)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists username text;

-- 3–24 chars, must start with a letter, letters/digits/underscore/dot only.
alter table public.profiles
  drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (
    username is null
    or username ~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$'
  );

-- Case-insensitive uniqueness (MaxMustermann and maxmustermann collide).
drop index if exists profiles_username_unique_idx;
create unique index profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

comment on column public.profiles.username is
  'Unique, user-chosen public handle shown during kit sharing. Never the real name, email, or user id.';

-- ---------------------------------------------------------------------------
-- 2. username_available — safe client-side live check (no auth required)
-- ---------------------------------------------------------------------------

create or replace function public.username_available(_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _username is not null
    and _username ~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$'
    and not exists (
      select 1 from public.profiles where lower(username) = lower(_username)
    );
$$;

comment on function public.username_available(text) is
  'Read-only availability probe. Never exposes which user owns a taken username.';

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. set_username — self-service, validated, unique, idempotent
-- ---------------------------------------------------------------------------

create or replace function public.set_username(_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _clean text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _clean := trim(coalesce(_username, ''));

  if _clean !~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$' then
    raise exception 'Ungültiger Benutzername. Erlaubt: 3-24 Zeichen, beginnend mit einem Buchstaben, danach Buchstaben, Zahlen, "_" oder ".".'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(_clean) and id <> _uid
  ) then
    raise exception 'Dieser Benutzername ist bereits vergeben.' using errcode = 'P0001';
  end if;

  update public.profiles
  set username = _clean, updated_at = now()
  where id = _uid;

  if not found then
    raise exception 'Profil wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  return _clean;
end;
$$;

comment on function public.set_username(text) is
  'Self-service username claim: validated, case-insensitively unique, only for the caller.';

revoke all on function public.set_username(text) from public;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. list_kit_share_members — username instead of display_name (real name)
-- ---------------------------------------------------------------------------
-- Kept the same name/signature-compatible shape (id, display_name) is NOT
-- reused here because kit sharing must show usernames, not real names.
-- Only members who have already set a username are selectable (they must
-- be able to recognize themselves and be recognized by others).

create or replace function public.list_kit_share_members()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username as display_name
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.username is not null
  order by lower(p.username);
$$;

comment on function public.list_kit_share_members() is
  'Eligible kit-share invite targets: username only, never real name/display_name/email. Excludes caller and users without a username.';

-- ---------------------------------------------------------------------------
-- 5. get_my_kit_share — participants show username, never display_name
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
  _is_creator boolean;
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
  _is_creator := _kit.creator_user_id = _uid;

  select quantity into _my_qty
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'isSelf', p.user_id = _uid,
        'displayName', case
          when p.user_id = _uid then 'Du'
          else coalesce(pr.username, 'Teilnehmer')
        end,
        'quantity', p.quantity
      ) || case when _is_creator then jsonb_build_object('userId', p.user_id) else '{}'::jsonb end
      order by case when p.user_id = _uid then 0 else 1 end, lower(coalesce(pr.username, ''))
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
    'isCreator', _is_creator,
    'participants', _participants
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. remove_kit_share_participant — creator-only removal (Phase 8 gap fix)
-- ---------------------------------------------------------------------------
-- Previously only self-removal (`leave_kit_share`) existed; the creator had
-- no way to remove another participant. Removing frees their quantity,
-- deletes their kit cart line, and re-syncs everyone else (their own
-- quantities are unchanged, but bulk-tier pricing depends on the kit's total
-- allocated quantity, so a resync keeps every remaining cart line correct).

create or replace function public.remove_kit_share_participant(
  _kit_share_id uuid,
  _participant_user_id uuid
)
returns jsonb
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
    raise exception 'Nur der Ersteller kann Teilnehmer entfernen.' using errcode = '42501';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if _participant_user_id = _kit.creator_user_id then
    raise exception 'Der Ersteller kann sich nicht selbst entfernen. Bitte stornieren.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _participant_user_id
  ) then
    raise exception 'Dieser Teilnehmer ist nicht Teil des Kits.' using errcode = 'P0002';
  end if;

  -- Remove the participant's kit cart line before deleting the row so the
  -- sync helper still finds the (now-stale) participant if it re-reads it.
  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and c.user_id = _participant_user_id
    and c.deleted_at is null
    and ci.kit_share_id = _kit_share_id;

  delete from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  -- Re-sync remaining participants (bulk-tier price may shift with the new
  -- allocated total even though nobody else's quantity changed).
  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

comment on function public.remove_kit_share_participant(uuid, uuid) is
  'Creator-only: removes a participant, deletes their kit cart line, and re-syncs remaining participant carts.';

revoke all on function public.remove_kit_share_participant(uuid, uuid) from public;
grant execute on function public.remove_kit_share_participant(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. create_kit_share — include isCreator so the client never has to guess
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

  if _kit_size_vials is null
     or _kit_size_vials < 10
     or _kit_size_vials > 100
     or mod(_kit_size_vials, 10) <> 0 then
    raise exception 'Ungültige Kitgröße. Die Größe muss ein Vielfaches von 10 sein.' using errcode = '22023';
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

  perform public.kit_share_sync_participant_cart(_kit.id, _uid);

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
    'canAddToCart', _kit.status = 'full',
    'isCreator', true,
    'cartSynced', true,
    'participants', jsonb_build_array(
      jsonb_build_object('isSelf', true, 'displayName', 'Du', 'quantity', _my_quantity)
    )
  );
end;
$$;

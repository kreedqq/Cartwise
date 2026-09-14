-- 0085: Kit Gesuche join-to-full fails under One Cart when carts.shop_area is retail.
--
-- Root cause:
-- kit_share_sync_participant_cart inserts kit lines into the single user cart.
-- reject_retail_kit_cart_item still checked carts.shop_area (often 'shop' after 0070).
-- Filling the last vial(s) syncs all participants → trigger raises → join rolls back.
-- Taking fewer vials leaves the kit open → no cart sync → appears to "work".
-- That looks like "5 free but can only take 4", but capacity math was already correct.
--
-- Fix:
-- 1) Reject retail kits by the kit/item shop_area profile, not the cart label.
-- 2) Allow own quantity updates on open marketplace kits (set allow GUC; sync only when full).
-- 3) Resolve leave/cancel/get_my_kit_share catalog via kit_share_catalog_product (vendor-only).
--
-- Does not loosen capacity checks, FOR UPDATE, or unique (kit_share_id, user_id).
-- Does not rewrite historical orders. Does not modify 0070 history.

-- ---------------------------------------------------------------------------
-- 1. One Cart: kit lines are allowed when the KIT area is group_buy
-- ---------------------------------------------------------------------------

create or replace function public.reject_retail_kit_cart_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
begin
  if NEW.kit_share_id is null then
    return NEW;
  end if;

  _area := NEW.shop_area;
  if _area is null then
    select shop_area into _area
    from public.kit_shares
    where id = NEW.kit_share_id;
  end if;

  if public.shop_area_pricing_profile(coalesce(_area, 'shop')) = 'retail' then
    raise exception 'Kits sind in diesem Shop-Bereich nicht verfügbar.' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

comment on function public.reject_retail_kit_cart_item() is
  'Blocks kit cart lines whose kit/item shop_area is retail. One Cart carts may keep shop_area=shop as a label; group_buy kit lines are allowed by item/kit area.';

revoke all on function public.reject_retail_kit_cart_item() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_my_kit_share — vendor-only / area catalog identity
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
  _my_ordered boolean;
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

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _is_creator := _kit.creator_user_id = _uid;

  select quantity, (ordered_at is not null) into _my_qty, _my_ordered
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
        'quantity', p.quantity,
        'hasOrdered', p.ordered_at is not null
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
    'productId', coalesce(public.kit_request_catalog_id(_kit), _product.id),
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
    'myHasOrdered', coalesce(_my_ordered, false),
    'participants', coalesce(_participants, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_kit_share(uuid) from public, anon;
grant execute on function public.get_my_kit_share(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. update_kit_share_quantity — open marketplace qty change + correct cart sync
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
  _others integer;
  _is_request boolean;
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

  _is_request := coalesce(_kit.is_open_request, false);

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if _is_request and _kit.status <> 'open' then
    raise exception 'Dieses Kit-Gesuch kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _uid;

  if not found then
    raise exception 'Keine Berechtigung, diese Menge zu ändern.' using errcode = '42501';
  end if;

  if _participant.ordered_at is not null then
    raise exception 'Deine Bestellung für dieses Kit wurde bereits abgeschlossen und kann nicht mehr geändert werden.' using errcode = 'P0001';
  end if;

  -- own current quantity is excluded: others + new_own <= kit_size
  _others := public.kit_share_allocated_total(_kit_share_id) - _participant.quantity;
  if _others + _quantity > _kit.kit_size_vials then
    raise exception 'Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar.' using errcode = 'P0001';
  end if;

  if _is_request then
    perform set_config('peptix.allow_kit_request_join', '1', true);
  end if;

  update public.kit_share_participants
  set quantity = _quantity, updated_at = now()
  where id = _participant.id;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  if _is_request then
    -- Marketplace: cart lines only when the request becomes full (same as join_kit_request).
    if _kit.status = 'full' then
      perform public.kit_share_sync_all_participant_carts(_kit_share_id);
      update public.kit_shares
      set completed_at = coalesce(completed_at, now()), updated_at = now()
      where id = _kit_share_id
      returning * into _kit;
    end if;
  else
    perform public.kit_share_sync_all_participant_carts(_kit_share_id);
  end if;

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

comment on function public.update_kit_share_quantity(uuid, integer) is
  'Updates caller quantity. Capacity = others + new_own <= kit_size (own not double-counted). Open kit requests set allow GUC and sync carts only when full.';

revoke all on function public.update_kit_share_quantity(uuid, integer) from public, anon;
grant execute on function public.update_kit_share_quantity(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. leave / cancel — vendor-only catalog resolve
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
  _product := public.kit_share_catalog_product(_kit);

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
  _product := public.kit_share_catalog_product(_kit);

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

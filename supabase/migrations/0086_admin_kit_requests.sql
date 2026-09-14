-- 0086_admin_kit_requests.sql
-- Admin management for marketplace kit requests (is_open_request = true).
-- Reuses existing capacity math, full-kit cart sync (0085), vendor catalog resolve,
-- and log_audit. Does not rewrite historical orders. Does not alter 0085/0070.
-- Product/vendor identity is not editable once a request exists.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.assert_admin_kit_request()
returns uuid
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
  if not public.has_role(_uid, 'admin') then
    raise exception 'Du bist nicht berechtigt, dieses Kit zu bearbeiten.' using errcode = '42501';
  end if;
  return _uid;
end;
$$;

revoke all on function public.assert_admin_kit_request() from public, anon, authenticated;

create or replace function public.admin_kit_request_list_item(_kit public.kit_shares)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _product public.products;
  _allocated integer;
  _creator_username text;
  _participant_count integer;
begin
  _product := public.kit_share_catalog_product(_kit);
  _allocated := public.kit_share_allocated_total(_kit.id);

  select username into _creator_username
  from public.profiles
  where id = _kit.creator_user_id;

  select count(*)::integer into _participant_count
  from public.kit_share_participants
  where kit_share_id = _kit.id;

  return jsonb_build_object(
    'id', _kit.id,
    'productId', public.kit_request_catalog_id(_kit),
    'productName', coalesce(_product.name, _kit.vendor_code, 'Unbekannt'),
    'productCode', coalesce(_product.code, _kit.vendor_code),
    'variantLabel', coalesce(nullif(trim(_product.dosage_vial), ''), _product.code, _kit.vendor_code),
    'category', public.kit_request_shop_category(_product),
    'kitSizeVials', _kit.kit_size_vials,
    'allocatedTotal', _allocated,
    'remainingVials', greatest(_kit.kit_size_vials - _allocated, 0),
    'status', _kit.status,
    'creatorUsername', coalesce(nullif(trim(_creator_username), ''), 'Teilnehmer'),
    'participantCount', coalesce(_participant_count, 0),
    'createdAt', _kit.created_at,
    'updatedAt', _kit.updated_at,
    'expiresAt', _kit.expires_at,
    'completedAt', _kit.completed_at,
    'note', _kit.note,
    'shopArea', _kit.shop_area,
    'vendorCode', _kit.vendor_code,
    'areaProductId', _kit.area_product_id,
    'masterProductId', _kit.product_id
  );
end;
$$;

revoke all on function public.admin_kit_request_list_item(public.kit_shares)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- List
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_kit_requests(
  _status text default null,
  _shop_area text default null,
  _search text default null,
  _page integer default 1,
  _page_size integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _items jsonb := '[]'::jsonb;
  _total integer := 0;
  _offset integer;
  _q text;
begin
  _uid := public.assert_admin_kit_request();
  perform public.kit_request_expire_overdue();

  if _page is null or _page < 1 then _page := 1; end if;
  if _page_size is null or _page_size < 1 then _page_size := 30; end if;
  if _page_size > 100 then _page_size := 100; end if;
  _offset := (_page - 1) * _page_size;
  _q := nullif(btrim(coalesce(_search, '')), '');

  if _status is not null
     and _status not in ('open', 'almost_full', 'full', 'cancelled', 'expired', 'ordered') then
    raise exception 'Ungültiger Statusfilter.' using errcode = '22023';
  end if;

  select count(*)::integer into _total
  from public.kit_shares k
  cross join lateral public.kit_share_catalog_product(k) p
  where coalesce(k.is_open_request, false)
    and (_shop_area is null or k.shop_area = _shop_area)
    and (
      _status is null
      or (_status = 'almost_full'
          and k.status = 'open'
          and (k.kit_size_vials - public.kit_share_allocated_total(k.id)) between 1 and 2)
      or (_status <> 'almost_full' and k.status = _status)
    )
    and (
      _q is null
      or coalesce(p.name, '') ilike '%' || _q || '%'
      or coalesce(p.code, '') ilike '%' || _q || '%'
      or coalesce(k.vendor_code, '') ilike '%' || _q || '%'
      or exists (
        select 1 from public.profiles pr
        where pr.id = k.creator_user_id
          and coalesce(pr.username, '') ilike '%' || _q || '%'
      )
    );

  select coalesce(jsonb_agg(card.item order by card.created_at desc), '[]'::jsonb)
  into _items
  from (
    select
      public.admin_kit_request_list_item(k) as item,
      k.created_at
    from public.kit_shares k
    cross join lateral public.kit_share_catalog_product(k) p
    where coalesce(k.is_open_request, false)
      and (_shop_area is null or k.shop_area = _shop_area)
      and (
        _status is null
        or (_status = 'almost_full'
            and k.status = 'open'
            and (k.kit_size_vials - public.kit_share_allocated_total(k.id)) between 1 and 2)
        or (_status <> 'almost_full' and k.status = _status)
      )
      and (
        _q is null
        or coalesce(p.name, '') ilike '%' || _q || '%'
        or coalesce(p.code, '') ilike '%' || _q || '%'
        or coalesce(k.vendor_code, '') ilike '%' || _q || '%'
        or exists (
          select 1 from public.profiles pr
          where pr.id = k.creator_user_id
            and coalesce(pr.username, '') ilike '%' || _q || '%'
        )
      )
    order by k.created_at desc
    offset _offset
    limit _page_size
  ) card;

  return jsonb_build_object(
    'items', coalesce(_items, '[]'::jsonb),
    'total', coalesce(_total, 0),
    'page', _page,
    'pageSize', _page_size
  );
end;
$$;

revoke all on function public.admin_list_kit_requests(text, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_list_kit_requests(text, text, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Detail
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _base jsonb;
  _participants jsonb := '[]'::jsonb;
  _any_ordered boolean := false;
  _cart_lines integer := 0;
begin
  _uid := public.assert_admin_kit_request();
  perform public.kit_request_expire_overdue();

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _base := public.admin_kit_request_list_item(_kit);

  select exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id and ordered_at is not null
  ) into _any_ordered;

  select count(*)::integer into _cart_lines
  from public.cart_items
  where kit_share_id = _kit.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', p.user_id,
        'username', coalesce(nullif(trim(pr.username), ''), 'Teilnehmer'),
        'quantity', p.quantity,
        'joinedAt', p.created_at,
        'updatedAt', p.updated_at,
        'hasOrdered', p.ordered_at is not null,
        'orderedAt', p.ordered_at,
        'orderId', p.order_id,
        'isCreator', p.user_id = _kit.creator_user_id,
        'hasCartItem', exists (
          select 1 from public.cart_items ci
          where ci.kit_share_id = _kit.id
            and exists (
              select 1 from public.carts c
              where c.id = ci.cart_id
                and c.user_id = p.user_id
                and c.deleted_at is null
            )
        )
      )
      order by case when p.user_id = _kit.creator_user_id then 0 else 1 end,
               p.created_at asc
    ),
    '[]'::jsonb
  )
  into _participants
  from public.kit_share_participants p
  left join public.profiles pr on pr.id = p.user_id
  where p.kit_share_id = _kit.id;

  return _base || jsonb_build_object(
    'participants', coalesce(_participants, '[]'::jsonb),
    'anyParticipantOrdered', coalesce(_any_ordered, false),
    'cartLineCount', coalesce(_cart_lines, 0),
    'canEditMeta', _kit.status in ('open', 'full', 'expired'),
    'canEditQuantities', _kit.status = 'open' and not coalesce(_any_ordered, false),
    'canCancel', _kit.status = 'open' and not coalesce(_any_ordered, false),
    'canChangeProduct', false
  );
end;
$$;

revoke all on function public.admin_get_kit_request(uuid) from public, anon;
grant execute on function public.admin_get_kit_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Meta: note / expires_at / kit_size (safe only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_kit_request_meta(
  _kit_share_id uuid,
  _note text default null,
  _expires_at timestamptz default null,
  _kit_size_vials integer default null,
  _clear_expires_at boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _allocated integer;
  _before jsonb;
  _clean_note text;
begin
  _uid := public.assert_admin_kit_request();

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit wurde bereits verarbeitet und kann nicht mehr auf diese Weise geändert werden.'
      using errcode = 'P0001';
  end if;

  _before := public.admin_kit_request_list_item(_kit);
  _allocated := public.kit_share_allocated_total(_kit.id);

  if _kit_size_vials is not null then
    if _kit_size_vials < 10 or _kit_size_vials > 100 or mod(_kit_size_vials, 10) <> 0 then
      raise exception 'Ungültige Kitgröße. Die Größe muss ein Vielfaches von 10 sein.' using errcode = '22023';
    end if;
    if _kit_size_vials < _allocated then
      raise exception 'Die neue Kitgröße darf die bereits belegte Menge nicht unterschreiten.'
        using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.kit_share_participants
      where kit_share_id = _kit.id and ordered_at is not null
    ) then
      raise exception 'Dieses Kit wurde bereits verarbeitet und kann nicht mehr auf diese Weise geändert werden.'
        using errcode = 'P0001';
    end if;
  end if;

  if _note is not null then
    _clean_note := nullif(btrim(_note), '');
    if _clean_note is not null and char_length(_clean_note) > 280 then
      raise exception 'Die Notiz darf höchstens 280 Zeichen lang sein.' using errcode = '22023';
    end if;
  end if;

  update public.kit_shares
  set
    note = case when _note is not null then _clean_note else note end,
    expires_at = case
      when _clear_expires_at then null
      when _expires_at is not null then _expires_at
      else expires_at
    end,
    kit_size_vials = coalesce(_kit_size_vials, kit_size_vials),
    updated_at = now()
  where id = _kit.id
  returning * into _kit;

  if _kit.status = 'open' and _kit_size_vials is not null then
    _kit := public.kit_share_refresh_status_locked(_kit.id);
    if _kit.status = 'full' then
      perform public.kit_share_sync_all_participant_carts(_kit.id);
      update public.kit_shares
      set completed_at = coalesce(completed_at, now()), updated_at = now()
      where id = _kit.id
      returning * into _kit;
    end if;
  end if;

  perform public.log_audit(
    _uid,
    'kit_request.admin_meta_update',
    'kit_share',
    _kit.id,
    _before,
    public.admin_kit_request_list_item(_kit)
  );

  return public.admin_get_kit_request(_kit.id);
end;
$$;

revoke all on function public.admin_update_kit_request_meta(uuid, text, timestamptz, integer, boolean)
  from public, anon;
grant execute on function public.admin_update_kit_request_meta(uuid, text, timestamptz, integer, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Participant quantity (same capacity SSoT as update_kit_share_quantity)
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_kit_request_participant_quantity(
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
  _uid uuid;
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _others integer;
  _before_qty integer;
begin
  _uid := public.assert_admin_kit_request();

  if _participant_user_id is null then
    raise exception 'Teilnehmer fehlt.' using errcode = '22023';
  end if;
  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status <> 'open' then
    raise exception 'Dieses Kit-Gesuch kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit.id and user_id = _participant_user_id;

  if not found then
    raise exception 'Dieser Teilnehmer ist nicht Teil des Kits.' using errcode = 'P0002';
  end if;

  if _participant.ordered_at is not null or _participant.order_id is not null then
    raise exception 'Dieses Kit wurde bereits verarbeitet und kann nicht mehr auf diese Weise geändert werden.'
      using errcode = 'P0001';
  end if;

  _before_qty := _participant.quantity;
  _others := public.kit_share_allocated_total(_kit.id) - _participant.quantity;
  if _others + _quantity > _kit.kit_size_vials then
    raise exception 'Die neue Menge überschreitet die verfügbare Kitgröße.' using errcode = 'P0001';
  end if;

  perform set_config('peptix.allow_kit_request_join', '1', true);

  update public.kit_share_participants
  set quantity = _quantity, updated_at = now()
  where id = _participant.id;

  _kit := public.kit_share_refresh_status_locked(_kit.id);

  if _kit.status = 'full' then
    perform public.kit_share_sync_all_participant_carts(_kit.id);
    update public.kit_shares
    set completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = _kit.id
    returning * into _kit;
  end if;

  perform public.log_audit(
    _uid,
    'kit_request.admin_quantity_update',
    'kit_share',
    _kit.id,
    jsonb_build_object(
      'participantUserId', _participant_user_id,
      'quantity', _before_qty
    ),
    jsonb_build_object(
      'participantUserId', _participant_user_id,
      'quantity', _quantity,
      'status', _kit.status,
      'allocatedTotal', public.kit_share_allocated_total(_kit.id)
    )
  );

  return public.admin_get_kit_request(_kit.id);
end;
$$;

revoke all on function public.admin_update_kit_request_participant_quantity(uuid, uuid, integer)
  from public, anon;
grant execute on function public.admin_update_kit_request_participant_quantity(uuid, uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Cancel (open marketplace only; no order mutation)
-- ---------------------------------------------------------------------------

create or replace function public.admin_cancel_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _before jsonb;
begin
  _uid := public.assert_admin_kit_request();

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status <> 'open' then
    raise exception 'Nur ein offenes Kit-Gesuch kann storniert werden.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id and ordered_at is not null
  ) then
    raise exception 'Dieses Kit wurde bereits verarbeitet und kann nicht mehr auf diese Weise geändert werden.'
      using errcode = 'P0001';
  end if;

  _before := public.admin_kit_request_list_item(_kit);

  -- Open marketplace kits have no cart lines yet (sync only on full).
  -- Still clear any stray kit cart lines without touching submitted orders.
  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and ci.kit_share_id = _kit.id
    and ci.submitted_order_id is null
    and c.deleted_at is null;

  update public.kit_shares
  set status = 'cancelled', updated_at = now()
  where id = _kit.id
  returning * into _kit;

  perform public.log_audit(
    _uid,
    'kit_request.admin_cancel',
    'kit_share',
    _kit.id,
    _before,
    public.admin_kit_request_list_item(_kit)
  );

  return public.admin_get_kit_request(_kit.id);
end;
$$;

revoke all on function public.admin_cancel_kit_request(uuid) from public, anon;
grant execute on function public.admin_cancel_kit_request(uuid) to authenticated;

comment on function public.admin_list_kit_requests(text, text, text, integer, integer) is
  'Admin-only paginated list of marketplace kit requests (is_open_request).';

comment on function public.admin_get_kit_request(uuid) is
  'Admin-only kit request detail with participant usernames and order/cart flags. No emails.';

comment on function public.admin_update_kit_request_meta(uuid, text, timestamptz, integer, boolean) is
  'Admin-only safe meta edits: note, expires_at, kit_size (>= allocated, 10-step). No product identity changes.';

comment on function public.admin_update_kit_request_participant_quantity(uuid, uuid, integer) is
  'Admin-only participant quantity update. Capacity = others + new_own <= kit_size. Full uses existing cart sync.';

comment on function public.admin_cancel_kit_request(uuid) is
  'Admin-only cancel for open marketplace kits without ordered participants. Does not mutate orders.';

-- 0124_admin_bulk_kit_requests.sql
-- Admin bulk cancel/delete for marketplace kit requests (atomic, same rules as single RPCs).

-- ---------------------------------------------------------------------------
-- List item: expose canCancel / canDelete for bulk UI (mirrors admin_get_kit_request)
-- ---------------------------------------------------------------------------

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
  _sync jsonb;
  _any_ordered boolean := false;
  _has_submitted_cart boolean := false;
begin
  _product := public.kit_share_catalog_product(_kit);
  _allocated := public.kit_share_allocated_total(_kit.id);

  select username into _creator_username
  from public.profiles
  where id = _kit.creator_user_id;

  select count(*)::integer into _participant_count
  from public.kit_share_participants
  where kit_share_id = _kit.id;

  select exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id
      and (ordered_at is not null or order_id is not null)
  ) into _any_ordered;

  select exists (
    select 1 from public.cart_items
    where kit_share_id = _kit.id and submitted_order_id is not null
  ) into _has_submitted_cart;

  _sync := public.kit_full_order_sync_summary(_kit.id);

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
    'masterProductId', _kit.product_id,
    'orderSyncLabel', _sync->>'label',
    'orderSyncSyncedCount', (_sync->>'syncedCount')::integer,
    'orderSyncParticipantCount', (_sync->>'participantCount')::integer,
    'canCancel', _kit.status = 'open' and not coalesce(_any_ordered, false),
    'canDelete', _kit.status in ('open', 'full', 'cancelled', 'expired')
      and not coalesce(_any_ordered, false)
      and not coalesce(_has_submitted_cart, false)
  );
end;
$$;

revoke all on function public.admin_kit_request_list_item(public.kit_shares)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bulk cancel (open marketplace kits only; mirrors admin_cancel_kit_request)
-- ---------------------------------------------------------------------------

create or replace function public.admin_cancel_kit_requests(_kit_share_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _ids uuid[];
  _id uuid;
  _kit public.kit_shares;
  _before jsonb;
  _product_name text;
  _cancelled_ids uuid[] := '{}'::uuid[];
  _count integer := 0;
begin
  _uid := public.assert_admin_kit_request();

  if _kit_share_ids is null or cardinality(_kit_share_ids) = 0 then
    raise exception 'Keine Kit-Gesuche ausgewählt.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into _ids
  from unnest(_kit_share_ids) as x;

  if cardinality(_ids) <> cardinality(_kit_share_ids) then
    raise exception 'Doppelte Kit-Gesuche in der Auswahl.' using errcode = 'P0001';
  end if;

  -- Lock all targets in deterministic order before validating or mutating.
  foreach _id in array _ids loop
    perform 1 from public.kit_shares where id = _id for update;
  end loop;

  foreach _id in array _ids loop
    select * into _kit from public.kit_shares where id = _id;
    if not found or not coalesce(_kit.is_open_request, false) then
      raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    _product_name := coalesce(
      (public.admin_kit_request_list_item(_kit)->>'productName'),
      'Kit-Gesuch'
    );

    if _kit.status <> 'open' then
      raise exception
        'Kit-Gesuch „%“ kann nicht storniert werden, da es nicht mehr offen ist.',
        _product_name
        using errcode = 'P0001';
    end if;

    if exists (
      select 1 from public.kit_share_participants
      where kit_share_id = _kit.id and ordered_at is not null
    ) then
      raise exception
        'Kit-Gesuch „%“ kann nicht storniert werden, da bereits eine Bestellung existiert.',
        _product_name
        using errcode = 'P0001';
    end if;
  end loop;

  foreach _id in array _ids loop
    select * into _kit from public.kit_shares where id = _id for update;
    _before := public.admin_kit_request_list_item(_kit);

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

    _cancelled_ids := array_append(_cancelled_ids, _kit.id);
    _count := _count + 1;
  end loop;

  perform public.log_audit(
    _uid,
    'kit_request.admin_bulk_cancelled',
    'kit_share',
    null,
    jsonb_build_object('ids', to_jsonb(_ids), 'count', _count),
    jsonb_build_object('cancelledIds', to_jsonb(_cancelled_ids), 'count', _count)
  );

  return jsonb_build_object(
    'cancelledCount', _count,
    'ids', to_jsonb(_cancelled_ids)
  );
end;
$$;

revoke all on function public.admin_cancel_kit_requests(uuid[]) from public, anon;
grant execute on function public.admin_cancel_kit_requests(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Bulk delete (mirrors admin_delete_kit_request)
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_kit_requests(_kit_share_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _ids uuid[];
  _id uuid;
  _kit public.kit_shares;
  _before jsonb;
  _product_name text;
  _deleted_ids uuid[] := '{}'::uuid[];
  _count integer := 0;
begin
  _uid := public.assert_admin_kit_request();

  if _kit_share_ids is null or cardinality(_kit_share_ids) = 0 then
    raise exception 'Keine Kit-Gesuche ausgewählt.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into _ids
  from unnest(_kit_share_ids) as x;

  if cardinality(_ids) <> cardinality(_kit_share_ids) then
    raise exception 'Doppelte Kit-Gesuche in der Auswahl.' using errcode = 'P0001';
  end if;

  foreach _id in array _ids loop
    perform 1 from public.kit_shares where id = _id for update;
  end loop;

  foreach _id in array _ids loop
    select * into _kit from public.kit_shares where id = _id;
    if not found or not coalesce(_kit.is_open_request, false) then
      raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    _product_name := coalesce(
      (public.admin_kit_request_list_item(_kit)->>'productName'),
      'Kit-Gesuch'
    );

    if exists (
      select 1 from public.kit_share_participants
      where kit_share_id = _kit.id
        and (ordered_at is not null or order_id is not null)
    ) then
      raise exception
        'Kit-Gesuch „%“ kann nicht gelöscht werden, da bereits eine Bestellung existiert.',
        _product_name
        using errcode = 'P0001';
    end if;

    if exists (
      select 1 from public.cart_items
      where kit_share_id = _kit.id and submitted_order_id is not null
    ) then
      raise exception
        'Kit-Gesuch „%“ kann nicht gelöscht werden, da bereits eine Bestellung existiert.',
        _product_name
        using errcode = 'P0001';
    end if;

    if _kit.status = 'ordered' then
      raise exception
        'Kit-Gesuch „%“ kann nicht gelöscht werden, da bereits eine Bestellung existiert.',
        _product_name
        using errcode = 'P0001';
    end if;
  end loop;

  foreach _id in array _ids loop
    select * into _kit from public.kit_shares where id = _id for update;
    _before := public.admin_kit_request_list_item(_kit);

    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and ci.kit_share_id = _kit.id
      and ci.submitted_order_id is null
      and c.deleted_at is null;

    perform set_config('peptix.allow_kit_request_join', '1', true);

    delete from public.kit_share_participants where kit_share_id = _kit.id;
    delete from public.kit_shares where id = _kit.id;

    perform public.log_audit(
      _uid,
      'kit_request.admin_delete',
      'kit_share',
      _id,
      _before,
      null
    );

    _deleted_ids := array_append(_deleted_ids, _id);
    _count := _count + 1;
  end loop;

  perform public.log_audit(
    _uid,
    'kit_request.admin_bulk_deleted',
    'kit_share',
    null,
    jsonb_build_object('ids', to_jsonb(_ids), 'count', _count),
    jsonb_build_object('deletedIds', to_jsonb(_deleted_ids), 'count', _count)
  );

  return jsonb_build_object(
    'deletedCount', _count,
    'ids', to_jsonb(_deleted_ids)
  );
end;
$$;

revoke all on function public.admin_delete_kit_requests(uuid[]) from public, anon;
grant execute on function public.admin_delete_kit_requests(uuid[]) to authenticated;

comment on function public.admin_cancel_kit_requests(uuid[]) is
  'Admin-only atomic bulk cancel for open marketplace kits. Same guards as admin_cancel_kit_request.';

comment on function public.admin_delete_kit_requests(uuid[]) is
  'Admin-only atomic bulk delete for marketplace kits without orders. Same guards as admin_delete_kit_request.';

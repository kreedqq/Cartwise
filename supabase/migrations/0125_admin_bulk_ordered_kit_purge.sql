-- 0125_admin_bulk_ordered_kit_purge.sql
-- Admin bulk cancel/delete may include ordered marketplace kits; delete removes
-- exclusively kit-linked orders (fail-closed on mixed order lines).

-- ---------------------------------------------------------------------------
-- Resolve order IDs linked to a kit (kit_share_id / participant / snapshots only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_kit_request_collect_order_ids(_kit_share_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  from (
    select p.order_id as x
    from public.kit_share_participants p
    where p.kit_share_id = _kit_share_id
      and p.order_id is not null
    union
    select ci.submitted_order_id
    from public.cart_items ci
    where ci.kit_share_id = _kit_share_id
      and ci.submitted_order_id is not null
    union
    select oi.order_id
    from public.order_items oi
    where oi.kit_share_id_snapshot = _kit_share_id
  ) linked
  where x is not null;
$$;

revoke all on function public.admin_kit_request_collect_order_ids(uuid)
  from public, anon, authenticated;

create or replace function public.admin_kit_request_assert_deletable_orders(
  _kit_share_id uuid,
  _product_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _order_id uuid;
  _order_ids uuid[];
begin
  _order_ids := public.admin_kit_request_collect_order_ids(_kit_share_id);

  foreach _order_id in array _order_ids loop
    if not exists (select 1 from public.orders where id = _order_id) then
      continue;
    end if;

    if exists (
      select 1
      from public.order_items oi
      where oi.order_id = _order_id
        and oi.kit_share_id_snapshot is distinct from _kit_share_id
    ) then
      raise exception
        'Kit-Gesuch „%“ kann nicht gelöscht werden, da die zugehörige Bestellung weitere nicht zu diesem Kit gehörende Positionen enthält.',
        _product_name
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.order_items oi
      where oi.order_id = _order_id
        and oi.kit_share_id_snapshot is null
    ) then
      raise exception
        'Kit-Gesuch „%“ kann nicht gelöscht werden, da die zugehörige Bestellung weitere nicht zu diesem Kit gehörende Positionen enthält.',
        _product_name
        using errcode = 'P0001';
    end if;

    if exists (
      select 1 from public.order_feedback f where f.order_id = _order_id
    ) then
      raise exception
        'Kit-Gesuch „%“ kann nicht gelöscht werden, da eine zugehörige Bestellung Feedback-Einträge hat.',
        _product_name
        using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

revoke all on function public.admin_kit_request_assert_deletable_orders(uuid, text)
  from public, anon, authenticated;

create or replace function public.admin_kit_request_delete_linked_orders(
  _kit_share_id uuid,
  _actor uuid,
  _product_name text
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  _order_id uuid;
  _order_ids uuid[];
  _deleted uuid[] := '{}'::uuid[];
  _order public.orders;
begin
  perform public.admin_kit_request_assert_deletable_orders(_kit_share_id, _product_name);
  _order_ids := public.admin_kit_request_collect_order_ids(_kit_share_id);

  foreach _order_id in array _order_ids loop
    select * into _order from public.orders where id = _order_id for update;
    if not found then
      continue;
    end if;

    delete from public.orders where id = _order_id;

    perform public.log_audit(
      _actor,
      'order.delete',
      'order',
      _order_id,
      jsonb_build_object(
        'orderNumber', _order.order_number,
        'status', _order.status,
        'kitShareId', _kit_share_id,
        'via', 'admin_kit_request_delete'
      ),
      null
    );

    _deleted := array_append(_deleted, _order_id);
  end loop;

  return _deleted;
end;
$$;

revoke all on function public.admin_kit_request_delete_linked_orders(uuid, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- List flags for bulk UI (detail RPC unchanged)
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
    'canCancel', coalesce(_kit.is_open_request, false)
      and _kit.status in ('open', 'full', 'ordered', 'expired'),
    'canDelete', coalesce(_kit.is_open_request, false)
      and (
        _kit.status = 'cancelled'
        or (
          _kit.status in ('open', 'full', 'expired')
          and not coalesce(_any_ordered, false)
          and not coalesce(_has_submitted_cart, false)
        )
      )
  );
end;
$$;

revoke all on function public.admin_kit_request_list_item(public.kit_shares)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bulk cancel (includes ordered/full kits; does not delete orders)
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

  foreach _id in array _ids loop
    perform 1 from public.kit_shares where id = _id for update;
    perform 1
    from public.kit_share_participants p
    where p.kit_share_id = _id
    for update;
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

    if _kit.status = 'cancelled' then
      raise exception
        'Kit-Gesuch „%“ ist bereits storniert.',
        _product_name
        using errcode = 'P0001';
    end if;

    if _kit.status not in ('open', 'full', 'ordered', 'expired') then
      raise exception
        'Kit-Gesuch „%“ kann nicht storniert werden.',
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
-- Bulk delete (cancelled kits; removes exclusive linked orders)
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
  _deleted_order_ids uuid[] := '{}'::uuid[];
  _kit_deleted_orders uuid[];
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
    perform 1
    from public.kit_share_participants p
    where p.kit_share_id = _id
    for update;
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

    if _kit.status <> 'cancelled'
       and not (
         _kit.status in ('open', 'full', 'expired')
         and not exists (
           select 1 from public.kit_share_participants p
           where p.kit_share_id = _kit.id
             and (p.ordered_at is not null or p.order_id is not null)
         )
         and not exists (
           select 1 from public.cart_items ci
           where ci.kit_share_id = _kit.id and ci.submitted_order_id is not null
         )
       )
    then
      raise exception
        'Kit-Gesuch „%“ muss zuerst storniert werden, bevor es gelöscht werden kann.',
        _product_name
        using errcode = 'P0001';
    end if;

    perform public.admin_kit_request_assert_deletable_orders(_kit.id, _product_name);
  end loop;

  foreach _id in array _ids loop
    select * into _kit from public.kit_shares where id = _id for update;
    _before := public.admin_kit_request_list_item(_kit);
    _product_name := coalesce(_before->>'productName', 'Kit-Gesuch');

    _kit_deleted_orders := public.admin_kit_request_delete_linked_orders(_kit.id, _uid, _product_name);
    _deleted_order_ids := _deleted_order_ids || coalesce(_kit_deleted_orders, '{}'::uuid[]);

    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and ci.kit_share_id = _kit.id
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
      jsonb_build_object('deletedOrderIds', to_jsonb(_kit_deleted_orders))
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
    jsonb_build_object(
      'deletedIds', to_jsonb(_deleted_ids),
      'deletedOrderIds', to_jsonb(_deleted_order_ids),
      'count', _count
    )
  );

  return jsonb_build_object(
    'deletedCount', _count,
    'ids', to_jsonb(_deleted_ids),
    'deletedOrderIds', to_jsonb(_deleted_order_ids)
  );
end;
$$;

revoke all on function public.admin_delete_kit_requests(uuid[]) from public, anon;
grant execute on function public.admin_delete_kit_requests(uuid[]) to authenticated;

comment on function public.admin_cancel_kit_requests(uuid[]) is
  'Admin-only atomic bulk cancel for marketplace kits including ordered kits. Does not delete orders.';

comment on function public.admin_delete_kit_requests(uuid[]) is
  'Admin-only atomic bulk delete; removes kit-exclusive linked orders when safe (fail-closed on mixed lines).';

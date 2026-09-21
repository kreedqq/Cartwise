-- 0126_admin_kit_list_cancel_flags.sql
-- Admin list flags: canCancel/canDelete for bulk UI must not depend on is_open_request.
-- Customer RPCs and 0113 unchanged. Bulk purge helpers and order logic unchanged.

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
    'canCancel', _kit.status in ('open', 'full', 'ordered', 'expired'),
    'canDelete',
      _kit.status = 'cancelled'
      or (
        _kit.status in ('open', 'full', 'expired')
        and not coalesce(_any_ordered, false)
        and not coalesce(_has_submitted_cart, false)
      )
  );
end;
$$;

revoke all on function public.admin_kit_request_list_item(public.kit_shares)
  from public, anon, authenticated;

comment on function public.admin_kit_request_list_item(public.kit_shares) is
  'Admin list row JSON. canCancel follows kit status only; is_open_request does not gate admin cancel/delete flags.';

-- 0108_kit_share_state_projection.sql
-- Central kit state projection + read-only reconciliation report (no auto-fix).

-- Threshold must match src/lib/kit/kitShareState.ts KIT_ALMOST_FULL_REMAINING_THRESHOLD
create or replace function public.kit_share_almost_full_threshold()
returns integer
language sql
immutable
as $$
  select 2;
$$;

revoke all on function public.kit_share_almost_full_threshold() from public, anon, authenticated;

create or replace function public.kit_share_project_state(_kit_share_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _allocated integer;
  _remaining integer;
  _locked boolean;
  _lock_reason text;
  _threshold integer;
begin
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return null;
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _remaining := greatest(0, _kit.kit_size_vials - _allocated);
  _locked := public.kit_share_customer_lock_active(_kit_share_id);
  _lock_reason := public.kit_share_customer_lock_reason(_kit_share_id);
  _threshold := public.kit_share_almost_full_threshold();

  return jsonb_build_object(
    'kitShareId', _kit.id,
    'status', _kit.status,
    'shopArea', _kit.shop_area,
    'isOpenRequest', coalesce(_kit.is_open_request, false),
    'allocatedQuantity', _allocated,
    'kitSize', _kit.kit_size_vials,
    'remainingQuantity', _remaining,
    'isAlmostFull',
      _kit.status = 'open'
      and _remaining > 0
      and _remaining <= _threshold,
    'isFull', _kit.status = 'full' or (_kit.kit_size_vials > 0 and _allocated = _kit.kit_size_vials),
    'isJoinable',
      coalesce(_kit.is_open_request, false)
      and _kit.status = 'open'
      and _remaining > 0
      and _kit.status not in ('cancelled', 'expired', 'ordered'),
    'isEditable',
      _kit.status = 'open'
      and not _locked
      and _allocated < _kit.kit_size_vials,
    'isOrdered', _kit.status = 'ordered',
    'isCancelled', _kit.status = 'cancelled',
    'isExpired', _kit.status = 'expired',
    'isLocked', _locked,
    'lockReason', _lock_reason
  );
end;
$$;

revoke all on function public.kit_share_project_state(uuid) from public, anon;
grant execute on function public.kit_share_project_state(uuid) to authenticated;

comment on function public.kit_share_project_state(uuid) is
  'Canonical derived kit flags for UI/admin. DB status on kit_shares remains SoT.';

-- Read-only reconciliation (does not mutate carts or orders)
create or replace function public.kit_share_reconcile_report(_kit_share_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _issues jsonb := '[]'::jsonb;
  _participant record;
  _cart_qty integer;
  _cart_id uuid;
  _state jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nicht autorisiert.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return jsonb_build_object('kitShareId', _kit_share_id, 'issues', '[]'::jsonb, 'reconciliationRequired', false);
  end if;

  _state := public.kit_share_project_state(_kit_share_id);

  if (_state->>'allocatedQuantity')::integer > (_state->>'kitSize')::integer then
    _issues := _issues || jsonb_build_array(jsonb_build_object(
      'code', 'ALLOCATION_OVERFLOW',
      'severity', 'error'
    ));
  end if;

  for _participant in
    select ksp.user_id, ksp.quantity
    from public.kit_share_participants ksp
    where ksp.kit_share_id = _kit_share_id
  loop
    select c.id into _cart_id
    from public.carts c
    where c.user_id = _participant.user_id
      and c.deleted_at is null
      and c.status = 'open'
    limit 1;

    select coalesce(sum(ci.quantity), 0)::integer into _cart_qty
    from public.cart_items ci
    where ci.cart_id = _cart_id
      and ci.kit_share_id = _kit_share_id;

    if _kit.status = 'full' and _cart_qty is distinct from _participant.quantity then
      _issues := _issues || jsonb_build_array(jsonb_build_object(
        'code', 'CART_QUANTITY_MISMATCH',
        'severity', 'warning',
        'userId', _participant.user_id,
        'participantQuantity', _participant.quantity,
        'cartQuantity', coalesce(_cart_qty, 0)
      ));
    end if;

    if _kit.status = 'full' and _cart_qty = 0 then
      _issues := _issues || jsonb_build_array(jsonb_build_object(
        'code', 'MISSING_CART_LINE',
        'severity', 'warning',
        'userId', _participant.user_id
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'kitShareId', _kit_share_id,
    'state', _state,
    'issues', _issues,
    'reconciliationRequired', jsonb_array_length(_issues) > 0
  );
end;
$$;

revoke all on function public.kit_share_reconcile_report(uuid) from public, anon;
grant execute on function public.kit_share_reconcile_report(uuid) to authenticated;

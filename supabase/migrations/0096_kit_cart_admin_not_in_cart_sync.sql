-- 0096: allow admin to sync a not_in_cart kit participant via restore_kit_share_cart_line.
-- Customer self-restore remains removed_from_cart only.

create or replace function public.restore_kit_share_cart_line(
  _kit_share_id uuid,
  _participant_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := auth.uid();
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _item_id uuid;
  _admin_not_in_cart boolean := false;
begin
  if _actor is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _participant_user_id is null or _kit_share_id is null then
    raise exception 'Ungültige Parameter.' using errcode = '22023';
  end if;

  if _actor is distinct from _participant_user_id
     and not public.has_role(_actor, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr in den Warenkorb gelegt werden.' using errcode = 'P0001';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id
  for update;

  if not found then
    raise exception 'Kit-Teilnehmer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _participant.ordered_at is not null or _participant.order_id is not null then
    raise exception 'Bestellte Kit-Anteile können nicht wiederhergestellt werden.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id and c.deleted_at is null
    where c.user_id = _participant_user_id
      and ci.kit_share_id = _kit_share_id
  ) then
    update public.kit_share_participants
    set cart_line_removed_at = null,
        cart_line_last_in_cart_at = coalesce(cart_line_last_in_cart_at, now()),
        updated_at = now()
    where id = _participant.id;

    perform public.log_audit(
      _actor,
      'kit_cart.restore',
      'kit_share',
      _kit_share_id,
      null,
      jsonb_build_object(
        'participantUserId', _participant_user_id,
        'alreadyInCart', true
      )
    );

    return jsonb_build_object('kitShareId', _kit_share_id, 'alreadyInCart', true);
  end if;

  if _participant.cart_line_removed_at is null then
    if not public.has_role(_actor, 'admin') then
      raise exception 'Für diesen Teilnehmer ist kein entfernter Kit-Anteil hinterlegt.' using errcode = 'P0001';
    end if;
    _admin_not_in_cart := true;
  end if;

  _item_id := public.kit_share_sync_participant_cart(_kit_share_id, _participant_user_id);
  if _item_id is null then
    raise exception 'Kit-Anteil konnte nicht in den Warenkorb gelegt werden.' using errcode = 'P0001';
  end if;

  perform public.log_audit(
    _actor,
    'kit_cart.restore',
    'kit_share',
    _kit_share_id,
    null,
    jsonb_build_object(
      'participantUserId', _participant_user_id,
      'cartItemId', _item_id,
      'quantity', _participant.quantity,
      'adminNotInCart', _admin_not_in_cart
    )
  );

  return jsonb_build_object(
    'kitShareId', _kit_share_id,
    'cartItemId', _item_id,
    'restored', true,
    'adminNotInCart', _admin_not_in_cart
  );
end;
$$;

revoke all on function public.restore_kit_share_cart_line(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.restore_kit_share_cart_line(uuid, uuid)
  to authenticated;

-- 0094: expose viewer-only kit cart presence on get_my_kit_share (no foreign cart leakage).

create or replace function public.kit_participant_cart_presence(
  _kit_share_id uuid,
  _user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _participant public.kit_share_participants;
  _in_cart boolean;
begin
  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _user_id;

  if not found then
    return 'not_in_cart';
  end if;

  if _participant.order_id is not null or _participant.ordered_at is not null then
    return 'ordered';
  end if;

  if _participant.cart_line_removed_at is not null then
    return 'removed_from_cart';
  end if;

  select exists (
    select 1
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id and c.deleted_at is null
    where c.user_id = _user_id
      and ci.kit_share_id = _kit_share_id
  ) into _in_cart;

  if _in_cart then
    return 'in_cart';
  end if;

  return 'not_in_cart';
end;
$$;

revoke all on function public.kit_participant_cart_presence(uuid, uuid) from public, anon, authenticated;

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
  _presence text;
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
  _presence := public.kit_participant_cart_presence(_kit_share_id, _uid);

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
    'myCartPresence', _presence,
    'myCanRestoreCartLine', (_presence = 'removed_from_cart'),
    'participants', coalesce(_participants, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_kit_share(uuid) from public, anon;
grant execute on function public.get_my_kit_share(uuid) to authenticated;

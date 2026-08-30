-- 0039_fix_kit_share_partial_order_completion.sql
--
-- ROOT CAUSE (reproduced): create_order() unconditionally set
-- `kit_shares.status = 'ordered'` for the WHOLE kit share as soon as ANY
-- participant's cart item was submitted. The next participant's own
-- create_order() call then re-read that kit and rejected it, because it
-- requires `kit.status = 'full'` — this is exactly the reported
-- `P0001 "Ungültiger Kit-Anteil im Warenkorb."` after Account A ordered
-- before Account B.
--
-- Fix: track completion per participant (kit_share_participants.ordered_at
-- / order_id), and only ever promote the whole kit_share to 'ordered' once
-- EVERY participant has ordered. Non-destructive/additive: existing rows
-- are untouched (ordered_at defaults to null), no existing order or cart is
-- modified, no migration is rewritten.

-- ---------------------------------------------------------------------------
-- 1. kit_share_participants — per-participant order completion snapshot
-- ---------------------------------------------------------------------------

alter table public.kit_share_participants
  add column if not exists ordered_at timestamptz;

alter table public.kit_share_participants
  add column if not exists order_id uuid references public.orders (id) on delete set null;

comment on column public.kit_share_participants.ordered_at is
  'Set once this participant successfully submits their own order for this kit share. NULL means still pending.';
comment on column public.kit_share_participants.order_id is
  'The order that fulfilled this participant''s kit share. NULL until ordered_at is set.';

-- ---------------------------------------------------------------------------
-- 2. create_order — per-participant kit completion, race-safe
-- ---------------------------------------------------------------------------

create or replace function public.create_order(
  _cart_id uuid,
  _note text default null,
  _payment_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart record;
  _item record;
  _product record;
  _order_id uuid;
  _order_number text;
  _position int := 0;
  _line_total numeric(12, 2);
  _total_usd numeric(14, 2) := 0;
  _total_eur numeric(14, 2) := 0;
  _eur_complete boolean := true;
  _line_count int;
  _rate numeric(12, 6);
  _markup numeric;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _eur numeric;
  _kit public.kit_shares;
  _kit_participant public.kit_share_participants;
  _kit_share_ids uuid[];
  _kit_share_id uuid;
  _remaining_unordered int;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _payment_method is null or _payment_method not in ('crypto', 'bank_transfer', 'paypal') then
    raise exception 'Bitte wählen Sie eine Zahlungsmethode aus.' using errcode = 'P0001';
  end if;

  select * into _cart
  from public.carts
  where id = _cart_id and user_id = auth.uid() and deleted_at is null
  for update;

  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  -- Idempotency (Phase 15): a cart can only ever be submitted once. This
  -- also covers double-click / refresh / network-retry re-submits of the
  -- same cart, since the very first successful create_order() already
  -- flips the cart to 'ordered' before returning.
  if _cart.status not in ('draft', 'ready') then
    raise exception 'Dieser Warenkorb wurde bereits bestellt oder ist archiviert.' using errcode = 'P0001';
  end if;

  select count(*) into _line_count
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = _cart_id
    and p.is_active
    and ci.quantity > 0;

  if _line_count = 0 then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  _markup := public.markup_percent_for(auth.uid());

  insert into public.orders (
    user_id, cart_id, status, note, payment_method, total_usd, total_eur, exchange_rate, submitted_at
  )
  values (
    auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), _payment_method,
    0, null, null, now()
  )
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*
    from public.cart_items ci
    where ci.cart_id = _cart_id and ci.quantity > 0
    order by ci.position
  loop
    select * into _product from public.products where id = _item.product_id and is_active;
    if not found then
      continue;
    end if;

    if _item.kit_share_id is not null then
      -- Lock the kit row: two participants of the SAME kit ordering at
      -- almost the same moment (Phase 14) must not race on the "did
      -- everyone order" completion check below.
      select * into _kit from public.kit_shares where id = _item.kit_share_id for update;

      -- A kit is orderable by a participant as soon as it is fully
      -- allocated ('full'). It MAY ALSO already be 'ordered' at this point
      -- — that only means *some other* participant finished first; it must
      -- never block a participant who has not ordered yet.
      if not found or _kit.status not in ('full', 'ordered') then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      select * into _kit_participant
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id and user_id = auth.uid()
      for update;

      if not found or _kit_participant.quantity <> _item.quantity then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      -- Defense in depth: this participant's own share of this kit was
      -- already fulfilled by a previous order (should already be blocked
      -- by the cart-level idempotency check above, since ordering deletes
      -- nothing and their cart would already be 'ordered' — kept as an
      -- explicit, readable guard).
      if _kit_participant.ordered_at is not null then
        raise exception 'Dieser Kit-Anteil wurde bereits bestellt.' using errcode = 'P0001';
      end if;

      _sell := _item.unit_price_usd_snapshot;
      _normal := _sell;
      _bulk := null;
      _tier := 'normal';

      update public.kit_share_participants
      set ordered_at = now(), order_id = _order_id, updated_at = now()
      where id = _kit_participant.id;

      if not (_item.kit_share_id = any(coalesce(_kit_share_ids, array[]::uuid[]))) then
        _kit_share_ids := coalesce(_kit_share_ids, array[]::uuid[]) || _item.kit_share_id;
      end if;
    else
      _sell := public.sell_unit_price(
        _product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity,
        _item.quantity, _markup
      );
      _normal := public.apply_role_markup(_product.price_usd, _markup);
      if _product.bulk_price_usd is not null and _product.bulk_price_min_quantity is not null and _product.bulk_price_min_quantity > 0 then
        _bulk := public.apply_role_markup(_product.bulk_price_usd, _markup);
        _tier := case when _item.quantity >= _product.bulk_price_min_quantity then 'bulk' else 'normal' end;
      else
        _bulk := null;
        _tier := 'normal';
      end if;
    end if;

    _line_total := round((_item.quantity * _sell)::numeric, 2);
    _total_usd := _total_usd + _line_total;

    _rate := _item.exchange_rate_snapshot;
    if _rate is not null and _rate > 0 then
      _eur := round((_line_total * _rate)::numeric, 2);
      _total_eur := _total_eur + _eur;
    else
      _eur := null;
      _eur_complete := false;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _product.id,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, _product.bulk_price_min_quantity,
      _tier, _sell, _item.quantity, _line_total,
      _rate, _eur
    );

    _position := _position + 1;
  end loop;

  update public.orders
  set total_usd = _total_usd,
      total_eur = case when _eur_complete then _total_eur else null end,
      exchange_rate = _rate
  where id = _order_id;

  -- Promote a kit share to 'ordered' ONLY once every participant has their
  -- own ordered_at set. Otherwise it must stay 'full' so the remaining
  -- participants can still order (this is the actual bug fix).
  if _kit_share_ids is not null then
    foreach _kit_share_id in array _kit_share_ids
    loop
      select count(*) into _remaining_unordered
      from public.kit_share_participants
      where kit_share_id = _kit_share_id and ordered_at is null;

      if _remaining_unordered = 0 then
        update public.kit_shares
        set status = 'ordered', updated_at = now()
        where id = _kit_share_id;
      end if;
    end loop;
  end if;

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber', _order_number,
      'totalUsd', _total_usd,
      'itemCount', _line_count,
      'paymentMethod', _payment_method
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

revoke all on function public.create_order(uuid, text, text) from public;
grant execute on function public.create_order(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2b. get_my_kit_share — expose per-participant order completion (Phase 13 UX)
-- ---------------------------------------------------------------------------
-- Lets the client disable "edit quantity" / "remove participant" controls
-- for a participant who already ordered, instead of only finding out via a
-- rejected RPC call. Additive fields only (hasOrdered / myHasOrdered).

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

  select * into _product from public.products where id = _kit.product_id;
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
    'myHasOrdered', coalesce(_my_ordered, false),
    'participants', _participants
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Protect already-ordered participant snapshots from later kit edits
-- ---------------------------------------------------------------------------
-- Phase 13: once a participant has ordered, their quantity is a locked
-- snapshot (the actual immutable copy already lives in order_items). These
-- guards additionally stop the *kit_share_participants* row itself from
-- drifting away from what was actually ordered, and stop a creator from
-- removing someone who already placed their order.

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

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
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

  _others := public.kit_share_allocated_total(_kit_share_id) - _participant.quantity;
  if _others + _quantity > _kit.kit_size_vials then
    raise exception 'Diese Kit Menge ist inzwischen nicht mehr vollständig verfügbar.' using errcode = 'P0001';
  end if;

  update public.kit_share_participants
  set quantity = _quantity, updated_at = now()
  where id = _participant.id;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

create or replace function public.update_kit_share_distribution(
  _kit_share_id uuid,
  _distribution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _entry jsonb;
  _user_id uuid;
  _quantity integer;
  _total integer := 0;
  _participant_count integer;
  _distribution_count integer;
  _existing public.kit_share_participants;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _distribution is null or jsonb_typeof(_distribution) <> 'array' then
    raise exception 'Ungültige Kit Verteilung.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.creator_user_id <> _uid then
    raise exception 'Nur der Ersteller kann die Verteilung bearbeiten.' using errcode = '42501';
  end if;

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  select count(*) into _participant_count
  from public.kit_share_participants
  where kit_share_id = _kit_share_id;

  _distribution_count := jsonb_array_length(_distribution);
  if _distribution_count <> _participant_count then
    raise exception 'Ungültige Kit Verteilung.' using errcode = 'P0001';
  end if;

  for _entry in select * from jsonb_array_elements(_distribution)
  loop
    _user_id := (_entry->>'userId')::uuid;
    _quantity := (_entry->>'quantity')::integer;

    if _user_id is null or _quantity is null or _quantity < 1 then
      raise exception 'Ungültige Kit Verteilung.' using errcode = '22023';
    end if;

    select * into _existing
    from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _user_id;

    if not found then
      raise exception 'Ungültige Kit Verteilung.' using errcode = 'P0001';
    end if;

    if _existing.ordered_at is not null and _existing.quantity <> _quantity then
      raise exception 'Ein Teilnehmer hat seine Bestellung bereits abgeschlossen; seine Menge ist ein fester Bestellwert und kann nicht mehr geändert werden.' using errcode = 'P0001';
    end if;

    _total := _total + _quantity;
  end loop;

  if _total <> _kit.kit_size_vials then
    raise exception 'Die Verteilung muss exakt der Kitgröße entsprechen.' using errcode = 'P0001';
  end if;

  if mod(_total, 10) <> 0 then
    raise exception 'Die Kit Verteilung ist ungültig. Die Gesamtmenge muss durch 10 teilbar sein.' using errcode = 'P0001';
  end if;

  for _entry in select * from jsonb_array_elements(_distribution)
  loop
    _user_id := (_entry->>'userId')::uuid;
    _quantity := (_entry->>'quantity')::integer;

    update public.kit_share_participants
    set quantity = _quantity, updated_at = now()
    where kit_share_id = _kit_share_id and user_id = _user_id;
  end loop;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);
  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

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
  _target public.kit_share_participants;
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

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  if _participant_user_id = _kit.creator_user_id then
    raise exception 'Der Ersteller kann sich nicht selbst entfernen. Bitte stornieren.' using errcode = 'P0001';
  end if;

  select * into _target
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  if not found then
    raise exception 'Dieser Teilnehmer ist nicht Teil des Kits.' using errcode = 'P0002';
  end if;

  if _target.ordered_at is not null then
    raise exception 'Dieser Teilnehmer hat bereits bestellt und kann nicht mehr entfernt werden.' using errcode = 'P0001';
  end if;

  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and c.user_id = _participant_user_id
    and c.deleted_at is null
    and ci.kit_share_id = _kit_share_id;

  delete from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  _kit := public.kit_share_refresh_status_locked(_kit_share_id);

  perform public.kit_share_sync_all_participant_carts(_kit_share_id);

  return public.get_my_kit_share(_kit_share_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. leave_kit_share / cancel_kit_share — cannot undo a placed order
-- ---------------------------------------------------------------------------

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

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
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

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and ordered_at is not null
  ) then
    raise exception 'Mindestens ein Teilnehmer hat bereits bestellt; dieses Kit kann nicht mehr storniert werden.' using errcode = 'P0001';
  end if;

  -- Never touch cart_items belonging to an already-`ordered` cart (a
  -- participant's placed order is a permanent snapshot; the guard above
  -- should already make this unreachable, but scope the delete anyway).
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
-- 5. kit_share_refresh_status_locked — never downgrade a fully-ordered kit
-- ---------------------------------------------------------------------------
-- Guards against a distribution edit accidentally reopening a kit whose
-- every participant has already ordered (should be unreachable given the
-- guards above, but kept defensive and explicit).

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

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
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

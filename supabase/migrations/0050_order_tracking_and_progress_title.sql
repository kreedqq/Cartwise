-- 0050_order_tracking_and_progress_title.sql
-- Additive: free customer-facing progress title + persistent shipment tracking.
-- Does not rewrite existing order rows, statuses, kit shares, or prices.
-- Customers keep SELECT of their own order; writes stay admin-only via has_role.

alter table public.order_progress
  add column if not exists title text;

comment on column public.order_progress.title is
  'Optional customer-facing heading. Independent of orders.status and of status_key templates.';

drop function if exists public.upsert_order_progress(uuid, text, integer, text);

create or replace function public.upsert_order_progress(
  _order_id uuid,
  _status_key text,
  _progress_percent integer,
  _comment text default null,
  _title text default null
)
returns public.order_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated public.order_progress;
  _clean_comment text;
  _clean_title text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen den Bestellfortschritt ändern.' using errcode = '42501';
  end if;

  if _status_key not in (
    'received',
    'processing',
    'submitted',
    'preparing_shipment',
    'shipped',
    'out_for_delivery',
    'arrived',
    'completed'
  ) then
    raise exception 'Ungültiger Lieferstatus.' using errcode = '22023';
  end if;

  if _progress_percent is null or _progress_percent < 0 or _progress_percent > 100 then
    raise exception 'Ungültiger Fortschritt.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.orders where id = _order_id) then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _clean_comment := nullif(trim(coalesce(_comment, '')), '');
  _clean_title := nullif(trim(coalesce(_title, '')), '');

  insert into public.order_progress (
    order_id, status_key, progress_percent, comment, title, updated_by, updated_at
  )
  values (
    _order_id, _status_key, _progress_percent, _clean_comment, _clean_title, auth.uid(), now()
  )
  on conflict (order_id) do update
    set status_key = excluded.status_key,
        progress_percent = excluded.progress_percent,
        comment = excluded.comment,
        title = excluded.title,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into _updated;

  perform public.log_audit(
    auth.uid(), 'order.progress_updated', 'order', _order_id,
    null,
    jsonb_build_object(
      'status_key', _updated.status_key,
      'progress_percent', _updated.progress_percent
    )
  );

  return _updated;
end;
$$;

comment on function public.upsert_order_progress(uuid, text, integer, text, text) is
  'Admin-only: upserts visual delivery progress. Title and comment are free text. Does not change orders.status.';

revoke all on function public.upsert_order_progress(uuid, text, integer, text, text) from public;
grant execute on function public.upsert_order_progress(uuid, text, integer, text, text) to authenticated;

alter table public.orders
  add column if not exists tracking_number text,
  add column if not exists tracking_carrier text,
  add column if not exists tracking_url text,
  add column if not exists tracking_assigned_at timestamptz,
  add column if not exists tracking_assigned_by uuid references auth.users (id) on delete set null,
  add column if not exists tracking_notification_sent_at timestamptz;

alter table public.orders drop constraint if exists orders_tracking_carrier_check;
alter table public.orders
  add constraint orders_tracking_carrier_check
  check (
    tracking_carrier is null
    or tracking_carrier in ('dhl', 'dpd', 'ups', 'gls', 'hermes', 'other')
  );

comment on column public.orders.tracking_number is
  'Shipment tracking number assigned by an admin. Customers may read their own order.';
comment on column public.orders.tracking_carrier is
  'Carrier key: dhl, dpd, ups, gls, hermes, other.';
comment on column public.orders.tracking_url is
  'Public tracking URL. Auto-built from carrier+number or entered by an admin.';
comment on column public.orders.tracking_notification_sent_at is
  'Set once after a successful first tracking email. Prevents duplicate sends.';

create or replace function public.upsert_order_tracking(
  _order_id uuid,
  _tracking_number text,
  _tracking_carrier text,
  _tracking_url text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _current public.orders;
  _updated public.orders;
  _clean_number text;
  _clean_carrier text;
  _clean_url text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Sendungsdaten ändern.' using errcode = '42501';
  end if;

  _clean_number := nullif(trim(coalesce(_tracking_number, '')), '');
  _clean_url := nullif(trim(coalesce(_tracking_url, '')), '');
  _clean_carrier := nullif(lower(trim(coalesce(_tracking_carrier, ''))), '');

  if _clean_number is not null and (
    _clean_carrier is null
    or _clean_carrier not in ('dhl', 'dpd', 'ups', 'gls', 'hermes', 'other')
  ) then
    raise exception 'Ungültiger Versanddienstleister.' using errcode = '22023';
  end if;

  if _clean_number is null then
    _clean_carrier := null;
    _clean_url := null;
  end if;

  select * into _current from public.orders where id = _order_id for update;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  update public.orders
  set tracking_number = _clean_number,
      tracking_carrier = _clean_carrier,
      tracking_url = _clean_url,
      tracking_assigned_at = case
        when _clean_number is null then null
        when _current.tracking_number is distinct from _clean_number then now()
        else coalesce(_current.tracking_assigned_at, now())
      end,
      tracking_assigned_by = case
        when _clean_number is null then null
        when _current.tracking_number is distinct from _clean_number then auth.uid()
        else coalesce(_current.tracking_assigned_by, auth.uid())
      end,
      updated_at = now()
  where id = _order_id
  returning * into _updated;

  perform public.log_audit(
    auth.uid(), 'order.tracking_updated', 'order', _order_id,
    jsonb_build_object(
      'tracking_number', _current.tracking_number,
      'tracking_carrier', _current.tracking_carrier
    ),
    jsonb_build_object(
      'tracking_number', _updated.tracking_number,
      'tracking_carrier', _updated.tracking_carrier
    )
  );

  return _updated;
end;
$$;

comment on function public.upsert_order_tracking(uuid, text, text, text) is
  'Admin-only: stores shipment tracking on an order. Does not change status, send email, or delete the order.';

revoke all on function public.upsert_order_tracking(uuid, text, text, text) from public;
grant execute on function public.upsert_order_tracking(uuid, text, text, text) to authenticated;

create or replace function public.mark_order_tracking_notified(_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated public.orders;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Tracking-Benachrichtigungen markieren.' using errcode = '42501';
  end if;

  update public.orders
  set tracking_notification_sent_at = coalesce(tracking_notification_sent_at, now()),
      updated_at = now()
  where id = _order_id
  returning * into _updated;

  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  return _updated;
end;
$$;

comment on function public.mark_order_tracking_notified(uuid) is
  'Admin-only: idempotently records that the first tracking email was sent. Never clears the timestamp.';

revoke all on function public.mark_order_tracking_notified(uuid) from public;
grant execute on function public.mark_order_tracking_notified(uuid) to authenticated;

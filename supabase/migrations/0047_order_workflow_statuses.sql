-- 0047_order_workflow_statuses.sql
-- Adds the admin workflow statuses used by Bestell Zusammenfassung.
-- Existing order rows and order numbers are not rewritten.
-- cancelled and confirmed stay valid so historical orders keep their values.
-- set_order_status remains admin-only SECURITY DEFINER; RLS is unchanged.

alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending',
    'processing',
    'dispatched',
    'received',
    'shipped',
    'completed',
    'confirmed',
    'cancelled'
  ));

create or replace function public.set_order_status(_order_id uuid, _status text, _admin_note text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _current public.orders;
  _updated public.orders;
  _clean_note text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen den Bestellstatus ändern.' using errcode = '42501';
  end if;

  if _status not in (
    'pending',
    'processing',
    'dispatched',
    'received',
    'shipped',
    'completed',
    'confirmed',
    'cancelled'
  ) then
    raise exception 'Ungültiger Status.' using errcode = '22023';
  end if;

  select * into _current from public.orders where id = _order_id for update;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  update public.orders
  set status = _status
  where id = _order_id
  returning * into _updated;

  _clean_note := nullif(trim(coalesce(_admin_note, '')), '');
  if _clean_note is not null then
    insert into public.order_admin_notes (order_id, note, updated_by, updated_at)
    values (_order_id, _clean_note, auth.uid(), now())
    on conflict (order_id) do update
      set note = excluded.note,
          updated_by = excluded.updated_by,
          updated_at = now();
  end if;

  if _status is distinct from _current.status then
    insert into public.order_status_history (order_id, old_status, new_status, changed_by)
    values (_order_id, _current.status, _status, auth.uid());

    perform public.log_audit(
      auth.uid(), 'order.status_changed', 'order', _order_id,
      jsonb_build_object('status', _current.status), jsonb_build_object('status', _status)
    );
  elsif _clean_note is not null then
    perform public.log_audit(
      auth.uid(), 'order.note_updated', 'order', _order_id, null, jsonb_build_object('adminNote', true)
    );
  end if;

  return _updated;
end;
$$;

comment on function public.set_order_status(uuid, text, text) is
  'Admin-only: changes an order''s status and/or its internal admin note, recording the transition in order_status_history and audit_logs.';

revoke all on function public.set_order_status(uuid, text, text) from public;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;

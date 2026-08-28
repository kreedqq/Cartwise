-- 0022_admin_delete_order.sql
-- Admins may permanently delete terminal orders (completed / cancelled).
-- Active orders (pending, processing, confirmed) are rejected server-side.
-- Dependent rows cascade: order_items, order_status_history, order_admin_notes.
-- Shipping lives on orders columns, so it disappears with the order row.
-- Clients still have no DELETE grant on orders (0018); only this DEFINER RPC writes.

create or replace function public.delete_order(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.orders;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Bestellungen löschen.' using errcode = '42501';
  end if;

  select * into _row from public.orders where id = _order_id for update;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _row.status not in ('completed', 'cancelled') then
    raise exception 'Nur abgeschlossene oder stornierte Bestellungen können gelöscht werden.' using errcode = 'P0001';
  end if;

  delete from public.orders where id = _order_id;

  perform public.log_audit(
    auth.uid(), 'order.delete', 'order', _order_id,
    jsonb_build_object('orderNumber', _row.order_number, 'status', _row.status),
    null
  );
end;
$$;

comment on function public.delete_order(uuid) is
  'Admin-only permanent delete of a completed or cancelled order. Cascades items, status history and admin notes.';

revoke all on function public.delete_order(uuid) from public;
grant execute on function public.delete_order(uuid) to authenticated;

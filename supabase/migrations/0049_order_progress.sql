-- 0049_order_progress.sql
-- Visual delivery progress, separate from orders.status workflow.
-- Existing orders, order numbers, snapshots, and workflow statuses are unchanged.
-- Customers may SELECT only their own row; writes are admin-only via has_role.

create table public.order_progress (
  order_id uuid primary key references public.orders (id) on delete cascade,
  status_key text not null check (status_key in (
    'received',
    'processing',
    'submitted',
    'preparing_shipment',
    'shipped',
    'out_for_delivery',
    'arrived',
    'completed'
  )),
  progress_percent integer not null check (progress_percent between 0 and 100),
  comment text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.order_progress is
  'Admin-controlled visual delivery progress for an order. Distinct from orders.status. Customers may read only their own order; they cannot write.';

alter table public.order_progress enable row level security;

create policy "order_progress_select_own_or_admin"
  on public.order_progress for select
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1
      from public.orders o
      where o.id = order_progress.order_id
        and o.user_id = auth.uid()
    )
  );

create policy "order_progress_admin_write"
  on public.order_progress for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.order_progress to authenticated;
grant select, insert, update, delete on public.order_progress to service_role;

create or replace function public.upsert_order_progress(
  _order_id uuid,
  _status_key text,
  _progress_percent integer,
  _comment text default null
)
returns public.order_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated public.order_progress;
  _clean_comment text;
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

  insert into public.order_progress (order_id, status_key, progress_percent, comment, updated_by, updated_at)
  values (_order_id, _status_key, _progress_percent, _clean_comment, auth.uid(), now())
  on conflict (order_id) do update
    set status_key = excluded.status_key,
        progress_percent = excluded.progress_percent,
        comment = excluded.comment,
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

comment on function public.upsert_order_progress(uuid, text, integer, text) is
  'Admin-only: upserts visual delivery progress for an order. Does not change orders.status.';

revoke all on function public.upsert_order_progress(uuid, text, integer, text) from public;
grant execute on function public.upsert_order_progress(uuid, text, integer, text) to authenticated;

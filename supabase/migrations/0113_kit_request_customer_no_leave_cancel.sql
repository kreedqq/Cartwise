-- 0113_kit_request_customer_no_leave_cancel.sql
-- Customers cannot leave or cancel kit gesuche after joining; admin uses admin_* RPCs.

create or replace function public.leave_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  raise exception
    'Bitte wende dich an den Admin, wenn du deinen Kit-Anteil ändern möchtest.'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.leave_kit_request(uuid) from public;
grant execute on function public.leave_kit_request(uuid) to authenticated;

create or replace function public.cancel_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  raise exception
    'Nur ein Admin kann ein Kit-Gesuch stornieren.'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.cancel_kit_request(uuid) from public;
grant execute on function public.cancel_kit_request(uuid) to authenticated;

comment on function public.leave_kit_request(uuid) is
  'Blocked for customers; kit participation is managed by admin after join.';
comment on function public.cancel_kit_request(uuid) is
  'Blocked for customers; use admin_cancel_kit_request for admin cancellation.';

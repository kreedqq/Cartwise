-- 0007_audit_logs.sql
-- Generic audit trail for product and role changes (admin-readable only).
-- Written exclusively by triggers (SECURITY DEFINER) or the service-role
-- Edge Functions - never directly by client code.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit trail. action examples: product.create, product.update, product.deactivate, role.grant, role.revoke, import.apply.';

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.has_role(auth.uid(), 'admin'));

-- Helper used by triggers/Edge Functions (all SECURITY DEFINER, so RLS is
-- bypassed for the insert itself, which is intentional: clients never call
-- this directly, only server-side code paths do).
create or replace function public.log_audit(
  _actor_id uuid,
  _action text,
  _entity_type text,
  _entity_id uuid,
  _before jsonb,
  _after jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Anti-forgery guard: a normal authenticated caller may only attribute an
  -- audit entry to themselves. Only the service-role (used exclusively by
  -- our own Edge Functions, which independently re-verify the admin role
  -- before calling this) may log on behalf of an arbitrary actor_id - e.g.
  -- when logging a role change performed *on* another user.
  if current_user <> 'service_role' and _actor_id is distinct from auth.uid() then
    raise exception 'actor_id muss der aufrufende Nutzer sein.' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (_actor_id, _action, _entity_type, _entity_id, _before, _after);
end;
$$;

-- Automatically audit product create/update/activate/deactivate.
create or replace function public.products_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(auth.uid(), 'product.create', 'product', new.id, null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    perform public.log_audit(auth.uid(), 'product.update', 'product', new.id, to_jsonb(old), to_jsonb(new));
  elsif tg_op = 'DELETE' then
    perform public.log_audit(auth.uid(), 'product.delete', 'product', old.id, to_jsonb(old), null);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger products_audit
  after insert or update or delete on public.products
  for each row execute function public.products_audit();

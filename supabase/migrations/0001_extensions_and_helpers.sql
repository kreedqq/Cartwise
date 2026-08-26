-- 0001_extensions_and_helpers.sql
-- Extensions and shared helper functions/triggers used by later migrations.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Generic "updated_at" bump, attached to every mutable table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: sets updated_at = now() on every UPDATE.';

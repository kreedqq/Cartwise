-- 0002_profiles_and_roles.sql
-- User profiles and a dedicated, server-only-writable role table.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  '1:1 profile data for each auth.users row.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;


create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

comment on table public.user_roles is
  'Authoritative role assignments. Writable only via service-role or the documented first-admin SQL bootstrap.';

create index user_roles_user_id_idx
  on public.user_roles (user_id);

alter table public.user_roles enable row level security;


create or replace function public.has_role(
  _user_id uuid,
  _role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

comment on function public.has_role(uuid, text) is
  'SECURITY DEFINER helper used by RLS policies to check role membership without recursive RLS on user_roles.';


create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  using (
    id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());


create policy "user_roles_select_own_or_admin"
  on public.user_roles
  for select
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'Neuer Nutzer')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (
    user_id,
    role
  )
  values (
    new.id,
    'user'
  )
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();